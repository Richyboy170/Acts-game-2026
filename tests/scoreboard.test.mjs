import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateTeamTotals,
  getGaugeState,
  getPhaseForScore,
  getTeamBarFillPercent,
  getTopTeams,
  validateScoreChange,
} from '../src/lib/scoreboard.js';

test('aggregates each team across all four games', () => {
  const totals = aggregateTeamTotals([
    { team_id: 'cat', game_id: 'sandwich', total_points: 40 },
    { team_id: 'cat', game_id: 'water-cup', total_points: 60 },
    { team_id: 'wolf', game_id: 'sandwich', total_points: 75 },
  ]);

  assert.deepEqual(totals, [
    { teamId: 'cat', total: 100 },
    { teamId: 'wolf', total: 75 },
  ]);
});

test('selects the correct background phase at each cumulative threshold', () => {
  assert.equal(getPhaseForScore(0), 1);
  assert.equal(getPhaseForScore(299), 1);
  assert.equal(getPhaseForScore(300), 2);
  assert.equal(getPhaseForScore(750), 3);
  assert.equal(getPhaseForScore(1400), 4);
  assert.equal(getPhaseForScore(2200), 5);
  assert.equal(getPhaseForScore(9000), 5);
});

test('extends the vertical gauge in 500 point steps after the last phase threshold', () => {
  assert.deepEqual(getGaugeState(2200), { maximum: 2200, fillPercent: 100, label: '2,200' });
  assert.deepEqual(getGaugeState(2201), { maximum: 2700, fillPercent: 81.52, label: '2,201' });
  assert.deepEqual(getGaugeState(2700), { maximum: 3200, fillPercent: 84.38, label: '2,700' });
});

test('scales team bars to the shared team mean instead of pegging the leader at full width', () => {
  assert.equal(getTeamBarFillPercent(200, [200, 200, 200, 200]), 50);
  assert.equal(getTeamBarFillPercent(20, [20, 20, 20, 20]), 6.67);
  assert.equal(getTeamBarFillPercent(400, [400, 100, 100, 100]), 74.07);
  assert.equal(getTeamBarFillPercent(0, [0, 0]), 0);
});

test('ranks teams using the sum from every game and shares tied places', () => {
  const ranked = getTopTeams([
    { team_id: 'cat', game_id: 'sandwich', total_points: 100 },
    { team_id: 'dragon', game_id: 'water-cup', total_points: 100 },
    { team_id: 'wolf', game_id: 'balloon-direction', total_points: 80 },
    { team_id: 'owl', game_id: 'get-the-ball-off', total_points: 20 },
  ]);

  assert.deepEqual(ranked, [
    { teamId: 'cat', total: 100, rank: 1 },
    { teamId: 'dragon', total: 100, rank: 1 },
    { teamId: 'wolf', total: 80, rank: 3 },
  ]);
});

test('validates awards and prevents corrections below zero', () => {
  assert.equal(validateScoreChange({ kind: 'award', delta: 25, currentTotal: 0 }), null);
  assert.equal(validateScoreChange({ kind: 'award', delta: -1, currentTotal: 10 }), 'Awards must add a positive whole number of points.');
  assert.equal(validateScoreChange({ kind: 'adjustment', delta: -12, currentTotal: 10 }), 'A correction cannot reduce a team below zero points for a game.');
  assert.equal(validateScoreChange({ kind: 'adjustment', delta: 0, currentTotal: 10 }), 'Enter a non-zero whole number of points.');
});
