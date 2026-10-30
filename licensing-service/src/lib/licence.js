// Pure licence rules: no I/O, so they can be unit tested and reasoned about.

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Work out what a licence allows at a point in time.
 *
 * States:
 *   not-started  before startsAt                     -> blocked
 *   active       valid, more than warningDays left   -> licensed
 *   expiring     valid, warningDays or fewer left    -> licensed + renewal notice
 *   grace        expired, within graceDays           -> licensed + daily warning
 *   expired      past expiry + grace                 -> blocked
 *   suspended    manually suspended (e.g. unpaid)    -> blocked
 */
export function evaluateLicence(licence, now, { warningDays = 30, defaultGraceDays = 7 } = {}) {
  if (licence.status === 'suspended') {
    return blocked('suspended', 'This licence is suspended. Contact your provider.');
  }

  const startsAt = licence.startsAt ? new Date(licence.startsAt) : null;
  const expiresAt = new Date(licence.expiresAt);
  if (Number.isNaN(expiresAt.getTime())) {
    return blocked('invalid', 'This licence has no valid expiry date. Contact your provider.');
  }
  if (startsAt && now < startsAt) {
    return blocked('not-started', `This licence starts on ${isoDate(startsAt)}.`);
  }

  const graceDays = Number.isFinite(Number(licence.graceDays)) ? Number(licence.graceDays) : defaultGraceDays;
  const graceEndsAt = new Date(expiresAt.getTime() + graceDays * DAY_MS);

  if (now <= expiresAt) {
    const daysLeft = Math.ceil((expiresAt - now) / DAY_MS);
    if (daysLeft <= warningDays) {
      return {
        state: 'expiring',
        licensed: true,
        daysLeft,
        expiresOn: isoDate(expiresAt),
        notice: `Licence renews or expires on ${isoDate(expiresAt)} (${daysLeft} day${daysLeft === 1 ? '' : 's'} left).`
      };
    }
    return { state: 'active', licensed: true, daysLeft, expiresOn: isoDate(expiresAt), notice: null };
  }

  if (now <= graceEndsAt) {
    const graceDaysLeft = Math.ceil((graceEndsAt - now) / DAY_MS);
    return {
      state: 'grace',
      licensed: true,
      daysLeft: 0,
      expiresOn: isoDate(expiresAt),
      notice: `Licence expired on ${isoDate(expiresAt)}. The agent stops starting new tasks in ${graceDaysLeft} day${graceDaysLeft === 1 ? '' : 's'} unless the licence is renewed.`
    };
  }

  return blocked('expired', `Licence expired on ${isoDate(expiresAt)}. New tasks are blocked until it is renewed.`, isoDate(expiresAt));
}

/** Is this agent covered by the licence? `agents` is stored as a comma-separated list. */
export function isAgentEntitled(licence, agentId) {
  return String(licence.agents || '')
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean)
    .includes(agentId);
}

function blocked(state, notice, expiresOn = null) {
  return { state, licensed: false, daysLeft: 0, expiresOn, notice };
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}
