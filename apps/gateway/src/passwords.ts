import crypto from 'node:crypto';

const ITERATIONS = 310000;
const KEY_LENGTH = 32;
const DIGEST = 'sha256';

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
  return `pbkdf2_sha256$${ITERATIONS}$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string | null) {
  if (!storedHash) {
    return false;
  }

  const [algorithm, iterationsText, salt, expectedHash] = storedHash.split('$');

  if (algorithm !== 'pbkdf2_sha256' || !iterationsText || !salt || !expectedHash) {
    return false;
  }

  const iterations = Number(iterationsText);
  const actualHash = crypto.pbkdf2Sync(password, salt, iterations, KEY_LENGTH, DIGEST);
  const expected = Buffer.from(expectedHash, 'hex');

  return expected.length === actualHash.length && crypto.timingSafeEqual(expected, actualHash);
}

export function createSetupToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashSetupToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
