'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatedNumber } from '@/components/animated-number.jsx';
import { GAME_BY_ID, TEAMS } from '@/lib/catalog.js';
import { getPhaseForScore } from '@/lib/scoreboard.js';

export function AdminGame() {
  const params = useParams();
  const game = GAME_BY_ID[params.game];
  const [totals, setTotals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [busyTeam, setBusyTeam] = useState(null);
  const [values, setValues] = useState({});
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setPageError('');
    try {
      const response = await fetch('/api/admin/scores', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not load scores.');
      setTotals(payload.totals ?? []);
    } catch (error) {
      setPageError(error.message || 'Could not load scores.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const currentScores = useMemo(() => Object.fromEntries(
    TEAMS.map((team) => [team.id, Number(totals.find((row) => row.game_id === game?.id && row.team_id === team.id)?.total_points ?? 0)]),
  ), [game, totals]);
  const eventTotal = totals.reduce((sum, row) => sum + Number(row.total_points ?? 0), 0);
  const phase = getPhaseForScore(eventTotal);

  async function changeScore(teamId, direction) {
    if (!game) return;
    const points = Number(values[teamId]);
    if (!Number.isInteger(points) || points <= 0) {
      setMessage({ type: 'error', text: 'Enter a positive whole number of points.' });
      return;
    }
    const delta = points * direction;
    setBusyTeam(teamId);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: game.id,
          teamId,
          kind: direction > 0 ? 'award' : 'adjustment',
          delta,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not save this award.');
      setValues((current) => ({ ...current, [teamId]: '' }));
      setMessage({ type: 'success', text: `${Math.abs(delta).toLocaleString('en-US')} points ${direction > 0 ? 'added to' : 'removed from'} ${TEAMS.find((team) => team.id === teamId)?.name}.` });
      await load();
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Could not save this award.' });
    } finally {
      setBusyTeam(null);
    }
  }

  if (!game) {
    return <div className="empty-state">That game could not be found. <Link href="/admin">Return to the game list.</Link></div>;
  }

  return (
    <>
      <div className="page-intro">
        <div className="eyebrow">Phase {phase} · {eventTotal.toLocaleString('en-US')} event points</div>
        <h1>{game.name}</h1>
        <p>Add points or remove a mistaken score for a team below. Every change is recorded in the score history.</p>
      </div>
      {message && <motion.div className={message.type === 'error' ? 'form-error' : 'form-success'} initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} role="status">{message.text}</motion.div>}
      {pageError && <div className="form-error" role="alert">{pageError}</div>}
      {loading ? <div className="empty-state">Loading team scores…</div> : (
        <div className="award-list">
          {TEAMS.map((team, index) => (
            <motion.section key={team.id} className="award-card" style={{ '--team-color': team.color }} initial={{ opacity: 0, x: index < 4 ? -8 : 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * .035 }}>
              <div className="award-crest"><img src={team.image} alt={`${team.name} crest`} /></div>
              <div>
                <h2 className="award-team-name">{team.name}</h2>
                <div className="award-current-score"><AnimatedNumber value={currentScores[team.id] ?? 0} /> points in {game.name}</div>
              </div>
              <label className="screen-reader-only" htmlFor={`award-${team.id}`}>Points to add or remove for {team.name}</label>
              <div className="award-points-control">
                <input id={`award-${team.id}`} className="field-input" inputMode="numeric" type="number" min="1" step="1" placeholder="Points" value={values[team.id] ?? ''} onChange={(event) => setValues((current) => ({ ...current, [team.id]: event.target.value }))} />
                <motion.button className="primary-button award-submit" type="button" onClick={() => changeScore(team.id, 1)} disabled={busyTeam !== null} whileTap={{ scale: .97 }}>
                  {busyTeam === team.id ? 'Saving…' : 'Add points'}
                </motion.button>
                <motion.button className="secondary-button award-submit" type="button" onClick={() => changeScore(team.id, -1)} disabled={busyTeam !== null} whileTap={{ scale: .97 }}>
                  {busyTeam === team.id ? 'Saving…' : 'Remove points'}
                </motion.button>
              </div>
            </motion.section>
          ))}
        </div>
      )}
      <div className="admin-actions">
        <Link className="secondary-button" href="/admin">Choose another game</Link>
        <Link className="secondary-button" href="/admin-score">Review all team scores</Link>
      </div>
      <AnimatePresence>{message?.type === 'success' && <motion.div key={message.text} className="toast-spark" initial={{ opacity: 0, scale: .3, y: 10 }} animate={{ opacity: [0, 1, 0], scale: [ .3, 1.1, 1.6], y: [10, -4, -20] }} transition={{ duration: 1.2 }} aria-hidden="true">✧</motion.div>}</AnimatePresence>
    </>
  );
}
