export const PHASE_THRESHOLDS = [300, 750, 1400, 2200];
export const FINAL_GAUGE_THRESHOLD = PHASE_THRESHOLDS.at(-1);
export const GAUGE_EXTENSION_STEP = 500;
export const TEAM_BAR_INITIAL_MAX = 500;
export const TEAM_BAR_SCALE_STEP = 100;

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

export function getAdminScoreDelta(value, direction) {
  const amount = Math.abs(Number(value));
  if (!Number.isInteger(amount) || amount <= 0 || ![1, -1].includes(direction)) return null;
  return amount * direction;
}

export function isResetConfirmationValid(value) {
  return typeof value === 'string' && value.trim().toUpperCase() === 'RESET';
}

export function getGaugeState(score) {
  const total = Math.max(0, Math.floor(Number(score) || 0));
  const additionalBands = total <= FINAL_GAUGE_THRESHOLD
    ? 0
    : Math.ceil((total - FINAL_GAUGE_THRESHOLD) / GAUGE_EXTENSION_STEP);
  const maximum = FINAL_GAUGE_THRESHOLD + additionalBands * GAUGE_EXTENSION_STEP;
  const fillPercent = total >= FINAL_GAUGE_THRESHOLD
    ? 100
    : maximum === 0 ? 0 : Math.min(100, (total / maximum) * 100);

  return {
    maximum,
    fillPercent: Math.round(fillPercent * 100) / 100,
    label: new Intl.NumberFormat('en-US').format(total),
  };
}

export function getTeamBarMaximum(teamTotals = []) {
  const maximumScore = Math.max(0, ...teamTotals.map(Number).filter(Number.isFinite));
  if (maximumScore < TEAM_BAR_INITIAL_MAX) return TEAM_BAR_INITIAL_MAX;
  const extensions = Math.floor((maximumScore - TEAM_BAR_INITIAL_MAX) / TEAM_BAR_SCALE_STEP) + 1;
  return TEAM_BAR_INITIAL_MAX + extensions * TEAM_BAR_SCALE_STEP;
}

export function getTeamBarFillPercent(score, teamTotals = []) {
  const value = Math.max(0, Number(score) || 0);
  const maximum = getTeamBarMaximum(teamTotals);
  return Math.round(Math.min(100, (value / maximum) * 100) * 100) / 100;
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
