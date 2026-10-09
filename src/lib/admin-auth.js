import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const ADMIN_SESSION_COOKIE = 'acts_admin_session';
export const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export function constantTimeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const leftHash = createHash('sha256').update(left).digest();
  const rightHash = createHash('sha256').update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

function signature(value, secret) {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

export function createAdminSession(username, secret, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({
    username,
    expiresAt: now + ADMIN_SESSION_TTL_MS,
  })).toString('base64url');
  return `${payload}.${signature(payload, secret)}`;
}

export function verifyAdminSession(token, secret, now = Date.now()) {
  if (typeof token !== 'string' || typeof secret !== 'string' || !secret) return null;

  const [payload, suppliedSignature, extra] = token.split('.');
  if (!payload || !suppliedSignature || extra) return null;

  const expectedSignature = signature(payload, secret);
  const expectedBuffer = Buffer.from(expectedSignature);
  const suppliedBuffer = Buffer.from(suppliedSignature);
  if (expectedBuffer.length !== suppliedBuffer.length || !timingSafeEqual(expectedBuffer, suppliedBuffer)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof session.username !== 'string' || !session.username || !Number.isFinite(session.expiresAt) || session.expiresAt <= now) {
      return null;
    }
    return { username: session.username, expiresAt: session.expiresAt };
  } catch {
    return null;
  }
}
