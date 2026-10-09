import test from 'node:test';
import assert from 'node:assert/strict';
import { formatSupabaseResetError } from '../src/lib/admin-errors.js';

test('includes the Supabase code and message in reset failures', () => {
  assert.equal(
    formatSupabaseResetError({ code: '42P01', message: 'relation does not exist' }),
    'Supabase reset failed (42P01): relation does not exist',
  );
});

test('formats reset failures when Supabase omits diagnostic fields', () => {
  assert.equal(formatSupabaseResetError(new Error('network failure')), 'Supabase reset failed: network failure');
  assert.equal(formatSupabaseResetError({}), 'Supabase reset failed. Check the Vercel runtime logs for details.');
});
