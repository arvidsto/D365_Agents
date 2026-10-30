import { evaluateLicence, isAgentEntitled, offlineCacheUntil } from './licence.js';
import { parseKey, keyMatches } from './keys.js';
import { watermark } from './skills.js';

// One place for the licensing decision, shared by the REST API and the MCP endpoint.
// Every result is { status, body, audit } where audit holds the only fields we log.

export function createService({ store, catalogue, settings = {}, clock = () => new Date() }) {
  const options = {
    warningDays: Number(settings.WARNING_DAYS ?? 30),
    defaultGraceDays: Number(settings.DEFAULT_GRACE_DAYS ?? 7),
    defaultOfflineHours: Number(settings.DEFAULT_OFFLINE_HOURS ?? 4),
    maxOfflineHours: Number(settings.MAX_OFFLINE_HOURS ?? 24)
  };

  const cacheUntil = (licence, evaluation) => offlineCacheUntil(licence, evaluation, clock(), options).toISOString();

  async function authorize({ key, tenantId, agentId }) {
    const audit = { licenceId: null, agentId, outcome: null };
    const parsed = parseKey(key);
    if (!parsed) return deny(401, 'invalid-key', 'Licence key missing or not recognised.', audit);

    audit.licenceId = parsed.licenceId;
    const licence = await store.get(parsed.licenceId);
    if (!licence || !keyMatches(parsed.key, licence.keyHash)) {
      return deny(401, 'invalid-key', 'Licence key missing or not recognised.', audit);
    }
    if (!catalogue[agentId]) {
      return deny(404, 'unknown-agent', `No agent named "${agentId}".`, audit);
    }
    if (licence.tenantId && tenantId && licence.tenantId.toLowerCase() !== String(tenantId).toLowerCase()) {
      return notLicensed('tenant-mismatch', 'This licence belongs to a different Microsoft tenant.', audit);
    }
    if (!isAgentEntitled(licence, agentId)) {
      return notLicensed('agent-not-licensed', `This licence does not include the agent "${agentId}".`, audit);
    }
    const evaluation = evaluateLicence(licence, clock(), options);
    if (!evaluation.licensed) {
      return notLicensed(evaluation.state, evaluation.notice, audit, evaluation.expiresOn);
    }
    return { ok: true, licence, evaluation, audit };
  }

  async function licenceStatus(req) {
    const auth = await authorize(req);
    if (!auth.ok) return auth.result;
    const { evaluation, licence, audit } = auth;
    return ok(audit, 'status', {
      licensed: true,
      state: evaluation.state,
      tier: licence.tier || null,
      expiresOn: evaluation.expiresOn,
      daysLeft: evaluation.daysLeft,
      notice: evaluation.notice,
      cacheUntil: cacheUntil(licence, evaluation)
    });
  }

  async function listSkills(req) {
    const auth = await authorize(req);
    if (!auth.ok) return auth.result;
    const { evaluation, licence, audit } = auth;
    const skills = Object.values(catalogue[req.agentId]).map((s) => ({
      name: s.name,
      version: s.version,
      description: s.description,
      settings: s.settings
    }));
    return ok(audit, 'list', {
      licensed: true,
      state: evaluation.state,
      notice: evaluation.notice,
      cacheUntil: cacheUntil(licence, evaluation),
      skills
    });
  }

  async function getSkill(req) {
    const auth = await authorize(req);
    if (!auth.ok) return auth.result;
    const { evaluation, licence, audit } = auth;
    audit.skill = req.skillName;
    const skill = catalogue[req.agentId][req.skillName];
    if (!skill) {
      return deny(404, 'unknown-skill', `No skill named "${req.skillName}" for agent "${req.agentId}".`, audit).result;
    }
    return ok(audit, 'get', {
      licensed: true,
      state: evaluation.state,
      notice: evaluation.notice,
      skill: skill.name,
      version: skill.version,
      settings: skill.settings,
      cacheUntil: cacheUntil(licence, evaluation),
      content: watermark(skill, { licenceId: licence.licenceId, agentId: req.agentId, now: clock() })
    });
  }

  return { licenceStatus, listSkills, getSkill };
}

function ok(audit, operation, body) {
  return { status: 200, body, audit: { ...audit, operation, outcome: body.state } };
}

// Licence-state problems return 200 with licensed:false so that agents and
// flows can read the reason and stop safely, instead of seeing a connector error.
function notLicensed(reason, message, audit, expiresOn = null) {
  return {
    ok: false,
    result: {
      status: 200,
      body: { licensed: false, state: reason, expiresOn, notice: message, content: null },
      audit: { ...audit, outcome: reason }
    }
  };
}

function deny(status, error, message, audit) {
  return { ok: false, result: { status, body: { licensed: false, error, message }, audit: { ...audit, outcome: error } } };
}
