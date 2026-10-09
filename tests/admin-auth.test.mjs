import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdminSession, verifyAdminSession } from '../src/lib/admin-auth.js';

test('accepts a valid signed admin session and rejects a changed token', () => {
  const token = createAdminSession('event-admin', 'test-session-secret', 1_000_000);

  assert.equal(verifyAdminSession(token, 'test-session-secret', 1_000_001)?.username, 'event-admin');
  assert.equal(verifyAdminSession(`${token}x`, 'test-session-secret', 1_000_001), null);
});

test('rejects expired admin sessions', () => {
  const token = createAdminSession('event-admin', 'test-session-secret', 1_000_000);

  assert.equal(verifyAdminSession(token, 'test-session-secret', 1_000_000 + 8 * 60 * 60 * 1000 + 1), null);
});
