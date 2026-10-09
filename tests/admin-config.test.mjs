import test from 'node:test';
import assert from 'node:assert/strict';
import { getAdminUsernames, verifyAdminCredentials } from '../src/lib/admin-config.js';

test('parses several configured admin usernames and removes blanks and duplicates', () => {
  assert.deepEqual(getAdminUsernames({ ADMIN_USERNAMES: ' alice, bob ,,alice ' }), ['alice', 'bob']);
});

test('accepts any configured username with the single shared password', () => {
  const env = { ADMIN_USERNAMES: 'alice,bob', ADMIN_PASSWORD: 'shared-password' };
  assert.equal(verifyAdminCredentials('bob', 'shared-password', env), true);
  assert.equal(verifyAdminCredentials('mallory', 'shared-password', env), false);
  assert.equal(verifyAdminCredentials('alice', 'wrong-password', env), false);
});

test('supports the legacy single-username setting during migration', () => {
  assert.deepEqual(getAdminUsernames({ ADMIN_USERNAME: 'captain' }), ['captain']);
});
