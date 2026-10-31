// Minimal stateless MCP server (Streamable HTTP, JSON responses only).
// Exposes three tools so any agent can use one standard connection:
//   licence_status, list_skills, get_skill

export const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const SERVER_INFO = { name: 'd365-agent-licensed-skills', version: '1.0.0' };

const TOOLS = [
  {
    name: 'licence_status',
    description: 'Checks whether this agent is licensed right now. Returns licensed (true/false), state (active, expiring, grace, expired, suspended) and a notice to show users. Call once at the start of a run.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'list_skills',
    description: 'Lists the business skills this agent may use: name, version and description (including its routing contract). Use it to choose exactly one skill for a task. Returns licensed=false if the licence does not allow use.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'get_skill',
    description: 'Returns the full instructions of ONE business skill by its exact name, for example InventoryClose_RunInventoryClose. Follow the returned instructions for this task only. If licensed is false, stop the task and report the notice.',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Exact skill name from list_skills.' } },
      required: ['name'],
      additionalProperties: false
    }
  }
];

/**
 * Handles one JSON-RPC message. Returns { status, body } where body is null
 * for notifications (HTTP 202, no content).
 */
export async function handleMcpMessage(message, { service, credentials }) {
  if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    return rpcError(message?.id ?? null, -32600, 'Invalid Request', 400);
  }
  const isNotification = message.id === undefined || message.id === null;

  switch (message.method) {
    case 'initialize': {
      const requested = message.params?.protocolVersion;
      const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requested) ? requested : SUPPORTED_PROTOCOL_VERSIONS[0];
      return result(message.id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: 'Load business skills with get_skill before acting. If any tool returns licensed=false, stop new work and report the notice.'
      });
    }
    case 'notifications/initialized':
    case 'notifications/cancelled':
      return { status: 202, body: null };
    case 'ping':
      return result(message.id, {});
    case 'tools/list':
      return result(message.id, { tools: TOOLS });
    case 'tools/call':
      return callTool(message, { service, credentials });
    default:
      if (isNotification) return { status: 202, body: null };
      return rpcError(message.id, -32601, `Method not found: ${message.method}`);
  }
}

async function callTool(message, { service, credentials }) {
  const name = message.params?.name;
  const args = message.params?.arguments || {};
  let outcome;
  if (name === 'licence_status') outcome = await service.licenceStatus(credentials);
  else if (name === 'list_skills') outcome = await service.listSkills(credentials);
  else if (name === 'get_skill') {
    if (typeof args.name !== 'string' || !args.name) {
      return rpcError(message.id, -32602, 'get_skill needs the argument "name".');
    }
    outcome = await service.getSkill({ ...credentials, skillName: args.name });
  } else {
    return rpcError(message.id, -32602, `Unknown tool: ${name}`);
  }

  const body = outcome.body;
  // For get_skill, return the skill text itself as the main content so the
  // orchestrator reads it as instructions; other results are JSON.
  const text = name === 'get_skill' && body.licensed && body.content
    ? `${body.notice ? `NOTICE: ${body.notice}\n\n` : ''}${body.content}`
    : JSON.stringify(body);
  return {
    status: 200,
    body: {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        content: [{ type: 'text', text }],
        structuredContent: body,
        isError: outcome.status !== 200 || body.licensed === false
      }
    },
    audit: outcome.audit
  };
}

function result(id, value) {
  return { status: 200, body: { jsonrpc: '2.0', id, result: value } };
}

function rpcError(id, code, messageText, status = 200) {
  return { status, body: { jsonrpc: '2.0', id, error: { code, message: messageText } } };
}
