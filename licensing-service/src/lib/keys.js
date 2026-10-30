import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

// Licence keys look like  <licenceId>.<secret>
// Only a SHA-256 hash of the full key is stored, so a leaked licence table
// does not reveal usable keys.

export function hashKey(key) {
  return createHash('sha256').update(key, 'utf8').digest('hex');
}

export function parseKey(key) {
  if (typeof key !== 'string') return null;
  const match = /^(lic-[a-z0-9]{8,32})\.([A-Za-z0-9_-]{32,128})$/.exec(key.trim());
  return match ? { licenceId: match[1], key: key.trim() } : null;
}

export function keyMatches(key, storedHash) {
  if (typeof storedHash !== 'string' || storedHash.length !== 64) return false;
  const a = Buffer.from(hashKey(key), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function newLicenceKey() {
  const licenceId = `lic-${randomBytes(6).toString('hex')}`;
  const secret = randomBytes(32).toString('base64url');
  const key = `${licenceId}.${secret}`;
  return { licenceId, key, keyHash: hashKey(key) };
}
