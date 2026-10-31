import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleMcpMessage } from '../src/lib/mcp.js';
import { setup } from './helpers.js';

const call = (service, key, message) =>
  handleMcpMessage(message, { service, credentials: { key, agentId: 'credit-hold-review-agent' } });

test('initialize negotiates a supported protocol version', async () => {
  const { service, key } = await setup();
  const r = await call(service, key, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } });
  assert.equal(r.body.result.protocolVersion, '2025-03-26');
  assert.ok(r.body.result.capabilities.tools);
  const r2 = await call(service, key, { jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '1999-01-01' } });
  assert.equal(r2.body.result.protocolVersion, '2025-06-18');
});

test('initialized notification gets 202 with no body', async () => {
  const { service, key } = await setup();
  const r = await call(service, key, { jsonrpc: '2.0', method: 'notifications/initialized' });
  assert.equal(r.status, 202);
  assert.equal(r.body, null);
});

test('tools/list exposes the three tools', async () => {
  const { service, key } = await setup();
  const r = await call(service, key, { jsonrpc: '2.0', id: 3, method: 'tools/list' });
  assert.deepEqual(r.body.result.tools.map((t) => t.name), ['licence_status', 'list_skills', 'get_skill']);
});

test('get_skill returns the skill text as content', async () => {
  const { service, key } = await setup();
  const r = await call(service, key, {
    jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'get_skill', arguments: { name: 'CHR_CreditPolicy' } }
  });
  assert.equal(r.body.result.isError, false);
  assert.match(r.body.result.content[0].text, /# Credit policy/);
});

test('expired licence makes get_skill an error result with the notice', async () => {
  const { service, key } = await setup({ now: '2027-03-01T00:00:00Z' });
  const r = await call(service, key, {
    jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'get_skill', arguments: { name: 'CHR_CreditPolicy' } }
  });
  assert.equal(r.body.result.isError, true);
  assert.equal(r.body.result.structuredContent.state, 'expired');
  assert.doesNotMatch(r.body.result.content[0].text, /Credit policy/);
});

test('get_skill without a name is an invalid-params error', async () => {
  const { service, key } = await setup();
  const r = await call(service, key, { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'get_skill', arguments: {} } });
  assert.equal(r.body.error.code, -32602);
});

test('unknown method is method-not-found', async () => {
  const { service, key } = await setup();
  const r = await call(service, key, { jsonrpc: '2.0', id: 7, method: 'resources/list' });
  assert.equal(r.body.error.code, -32601);
});
