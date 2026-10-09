import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('reset migration explicitly targets every score entry', () => {
  const migration = readFileSync(new URL('../supabase/migrations/202610090003_event_score_reset_delete_predicate.sql', import.meta.url), 'utf8');
  assert.match(migration, /delete\s+from\s+public\.score_entries\s+where\s+id\s+is\s+not\s+null\s*;/i);
});
