import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, TENANT } from './helpers.js';

const AGENT = 'inventory-close-agent';
const SKILL = 'InventoryClose_RunInventoryClose';

test('valid key returns the watermarked skill', async () => {
  const { service, key, licenceId } = await setup();
  const r = await service.getSkill({ key, tenantId: TENANT, agentId: AGENT, skillName: SKILL });
  assert.equal(r.status, 200);
  assert.equal(r.body.licensed, true);
  assert.match(r.body.content, /name: InventoryClose_RunInventoryClose/);
  assert.match(r.body.content, new RegExp(`licence=${licenceId} agent=${AGENT} skill=${SKILL}@1.2.0`));
});

test('list returns names and descriptions only, never skill bodies', async () => {
  const { service, key } = await setup();
  const r = await service.listSkills({ key, agentId: AGENT });
  assert.equal(r.body.licensed, true);
  assert.ok(r.body.skills.length >= 7);
  for (const s of r.body.skills) {
    assert.deepEqual(Object.keys(s).sort(), ['description', 'name', 'routing', 'settings', 'version']);
  }
  const close = r.body.skills.find((s) => s.name === 'InventoryClose_RunInventoryClose');
  assert.equal(close.routing, 'run inventory close');
});

test('missing, malformed and wrong keys get the same 401', async () => {
  const { service, key } = await setup();
  const wrong = key.slice(0, -4) + 'AAAA';
  for (const k of [undefined, 'nonsense', wrong]) {
    const r = await service.getSkill({ key: k, agentId: AGENT, skillName: SKILL });
    assert.equal(r.status, 401);
    assert.equal(r.body.error, 'invalid-key');
    assert.equal(r.body.content, undefined);
  }
});

test('expired licence returns licensed=false with no content', async () => {
  const { service, key } = await setup({ now: '2027-02-01T00:00:00Z' });
  const r = await service.getSkill({ key, agentId: AGENT, skillName: SKILL });
  assert.equal(r.status, 200);
  assert.equal(r.body.licensed, false);
  assert.equal(r.body.state, 'expired');
  assert.equal(r.body.content, null);
});

test('grace period still serves content with a notice', async () => {
  const { service, key } = await setup({ now: '2027-01-03T00:00:00Z' });
  const r = await service.getSkill({ key, agentId: AGENT, skillName: SKILL });
  assert.equal(r.body.licensed, true);
  assert.equal(r.body.state, 'grace');
  assert.ok(r.body.notice);
});

test('tenant mismatch is refused when a tenant is sent', async () => {
  const { service, key } = await setup();
  const r = await service.getSkill({ key, tenantId: 'aaaaaaaa-0000-0000-0000-000000000000', agentId: AGENT, skillName: SKILL });
  assert.equal(r.body.licensed, false);
  assert.equal(r.body.state, 'tenant-mismatch');
});

test('agent not in the licence is refused', async () => {
  const { service, key } = await setup({ licence: { agents: 'credit-hold-review-agent' } });
  const r = await service.getSkill({ key, agentId: AGENT, skillName: SKILL });
  assert.equal(r.body.licensed, false);
  assert.equal(r.body.state, 'agent-not-licensed');
});

test('unknown skill and unknown agent return 404', async () => {
  const { service, key } = await setup();
  assert.equal((await service.getSkill({ key, agentId: AGENT, skillName: 'Nope' })).status, 404);
  assert.equal((await service.listSkills({ key, agentId: 'nope-agent' })).status, 404);
});

test('a skill of another agent cannot be read through this agent', async () => {
  const { service, key } = await setup();
  const r = await service.getSkill({ key, agentId: AGENT, skillName: 'CHR_CreditPolicy' });
  assert.equal(r.status, 404);
});

test('audit records only allowed fields and never the key', async () => {
  const { service, key } = await setup();
  const r = await service.getSkill({ key, tenantId: TENANT, agentId: AGENT, skillName: SKILL });
  assert.ok(!JSON.stringify(r.audit).includes(key));
  assert.ok(!JSON.stringify(r.audit).includes(TENANT));
});

test('skill response says how long it may be cached and which settings it needs', async () => {
  const { service, key } = await setup({ now: '2026-06-01T00:00:00Z' });
  const r = await service.getSkill({ key, agentId: AGENT, skillName: SKILL });
  assert.equal(r.body.cacheUntil, '2026-06-01T04:00:00.000Z');
  assert.deepEqual(r.body.settings, ['ica_BatchGroup', 'ica_BusinessHours']);
  assert.match(r.body.content, /\{\{env:ica_BatchGroup\}\}/); // filled in the customer's tenant, not here
});

test('every placeholder in every skill uses the env: form', async () => {
  const { loadCatalogue } = await import('../src/lib/skills.js');
  const catalogue = await loadCatalogue();
  for (const skills of Object.values(catalogue)) {
    for (const s of Object.values(skills)) {
      assert.equal(/\{\{(?!env:)[^}]*\}\}/.test(s.raw), false, s.name);
      assert.equal(/(?<!\{)\{[a-z][A-Za-z]*\}(?!\})/.test(s.body.replace(/```[\s\S]*?```/g, '')), false, `${s.name} has an old {name} placeholder`);
    }
  }
});
