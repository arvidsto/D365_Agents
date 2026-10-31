import { app } from '@azure/functions';
import { getService, credentialsFrom } from '../lib/runtime.js';
import { handleMcpMessage } from '../lib/mcp.js';
import { safeLog } from '../lib/log.js';

// MCP endpoint for Copilot Studio: POST /api/mcp/{agentId}
// Auth header x-licence-key (configure as API key in the MCP onboarding wizard).

app.http('mcp', {
  methods: ['POST', 'GET', 'DELETE'],
  authLevel: 'function',
  route: 'mcp/{agentId}',
  handler: async (request, context) => {
    if (request.method !== 'POST') {
      // Stateless server: no server-initiated stream, no sessions to delete.
      return { status: 405, headers: { Allow: 'POST' } };
    }
    let message;
    try {
      message = await request.json();
    } catch {
      return { status: 400, jsonBody: { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } } };
    }
    if (Array.isArray(message)) {
      return { status: 400, jsonBody: { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Batching is not supported' } } };
    }
    const service = await getService();
    const outcome = await handleMcpMessage(message, {
      service,
      credentials: credentialsFrom(request, request.params.agentId)
    });
    safeLog(context, outcome.audit);
    if (outcome.body === null) return { status: outcome.status };
    return { status: outcome.status, jsonBody: outcome.body, headers: { 'Cache-Control': 'no-store' } };
  }
});
