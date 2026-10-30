// The only fields ever logged. No request bodies, no headers, no keys,
// no IP addresses, no user identities — nothing from the customer's data.
const ALLOWED = ['operation', 'licenceId', 'agentId', 'skill', 'outcome'];

export function safeLog(context, audit) {
  if (!audit) return;
  const entry = {};
  for (const field of ALLOWED) if (audit[field] != null) entry[field] = audit[field];
  context.log(JSON.stringify({ event: 'licensed-skill-request', ...entry }));
}
