export const PHASE_THRESHOLDS = [300, 750, 1400, 2200];
export const FINAL_GAUGE_THRESHOLD = PHASE_THRESHOLDS.at(-1);
export const GAUGE_EXTENSION_STEP = 500;
export const TEAM_BAR_MIN_SCALE = PHASE_THRESHOLDS[0];
export const TEAM_BAR_LEADER_HEADROOM = 1.35;

export function aggregateTeamTotals(rows = [], teamIds = []) {
  const totals = new Map(teamIds.map((teamId) => [teamId, 0]));

  for (const row of rows) {
    const teamId = row.teamId ?? row.team_id;
    const points = Number(row.total ?? row.total_points ?? 0);
    if (!teamId || !Number.isFinite(points)) continue;
    totals.set(teamId, (totals.get(teamId) ?? 0) + points);
  }

  return [...totals.entries()]
    .map(([teamId, total]) => ({ teamId, total }))
    .sort((left, right) => right.total - left.total || left.teamId.localeCompare(right.teamId));
}

export function getPhaseForScore(score) {
  const value = Math.max(0, Number(score) || 0);
  return 1 + PHASE_THRESHOLDS.filter((threshold) => value >= threshold).length;
}

export function getGaugeState(score) {
  const total = Math.max(0, Math.floor(Number(score) || 0));
  const additionalBands = total <= FINAL_GAUGE_THRESHOLD
    ? 0
    : Math.floor((total - FINAL_GAUGE_THRESHOLD) / GAUGE_EXTENSION_STEP) + 1;
  const maximum = FINAL_GAUGE_THRESHOLD + additionalBands * GAUGE_EXTENSION_STEP;
  const fillPercent = maximum === 0 ? 0 : Math.min(100, (total / maximum) * 100);

  return {
    maximum,
    fillPercent: Math.round(fillPercent * 100) / 100,
    label: new Intl.NumberFormat('en-US').format(total),
  };
}

export function getTeamBarFillPercent(score, teamTotals = []) {
  const value = Math.max(0, Number(score) || 0);
  const values = teamTotals.map(Number).filter(Number.isFinite).map((total) => Math.max(0, total));
  if (values.length === 0) values.push(value);
  const mean = values.reduce((sum, total) => sum + total, 0) / values.length;
  const leader = Math.max(value, ...values);
  const scale = Math.max(TEAM_BAR_MIN_SCALE, mean * 2, leader * TEAM_BAR_LEADER_HEADROOM);
  return Math.round(Math.min(100, (value / scale) * 100) * 100) / 100;
}

export function getTopTeams(rows = [], teamIds = [], limit = 3) {
  const totals = aggregateTeamTotals(rows, teamIds);
  let previousTotal = null;
  let previousRank = 0;

  return totals
    .map((team, index) => {
      const rank = team.total === previousTotal ? previousRank : index + 1;
      previousTotal = team.total;
      previousRank = rank;
      return { ...team, rank };
    })
    .filter((team) => team.rank <= limit);
}

export function validateScoreChange({ kind, delta, currentTotal }) {
  if (!Number.isInteger(delta) || !Number.isInteger(currentTotal) || currentTotal < 0) {
    return 'Enter a whole number of points.';
  }
  if (delta === 0) return 'Enter a non-zero whole number of points.';
  if (kind === 'award' && delta < 0) return 'Awards must add a positive whole number of points.';
  if (kind !== 'award' && kind !== 'adjustment') return 'Choose a valid score change type.';
  if (currentTotal + delta < 0) return 'A correction cannot reduce a team below zero points for a game.';
  return null;
}
