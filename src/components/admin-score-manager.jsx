'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatedNumber } from '@/components/animated-number.jsx';
import { GAMES, TEAMS } from '@/lib/catalog.js';

const formatTime = (value) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export function AdminScoreManager() {
  const [data, setData] = useState({ totals: [], entries: [], finalization: null, finalizationEvents: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState({});
  const [forms, setForms] = useState({});
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const response = await fetch('/api/admin/scores', { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not load the score history.');
      setData(payload);
    } catch (cause) { setError(cause.message || 'Could not load the score history.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const teamTotals = useMemo(() => Object.fromEntries(TEAMS.map((team) => [team.id,
    data.totals.filter((row) => row.team_id === team.id).reduce((sum, row) => sum + Number(row.total_points || 0), 0),
  ])), [data.totals]);
  const totalEventPoints = Object.values(teamTotals).reduce((sum, value) => sum + value, 0);

  async function submitAdjustment(team, game) {
    const key = `${team.id}:${game.id}`;
    const form = forms[key] || {};
    const delta = Number(form.delta);
    if (!Number.isInteger(delta) || delta === 0) { setMessage('Enter a non-zero whole number.'); return; }
    setBusy(key); setMessage('');
    try {
      const response = await fetch('/api/admin/scores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gameId: game.id, teamId: team.id, kind: 'adjustment', delta, note: form.note || '', idempotencyKey: crypto.randomUUID() }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not save this correction.');
      setForms((current) => ({ ...current, [key]: { delta: '', note: '' } }));
      setMessage(`Saved ${delta > 0 ? '+' : ''}${delta} points for ${team.name} in ${game.name}.`);
      await load();
    } catch (cause) { setMessage(cause.message || 'Could not save this correction.'); }
    finally { setBusy(''); }
  }

  async function lockResults() {
    setBusy('finalize'); setMessage('');
    try {
      const response = await fetch('/api/admin/finalize', { method: 'POST' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not finalize the event.');
      setMessage('Event results finalized. Later score corrections will refresh the reveal automatically.');
      await load();
    } catch (cause) { setMessage(cause.message || 'Could not finalize the event.'); }
    finally { setBusy(''); }
  }

  async function resetScores(event) {
    event.preventDefault();
    if (resetConfirmation.trim() !== 'RESET') return;
    setBusy('reset'); setError(''); setMessage('');
    try {
      const response = await fetch('/api/admin/reset-scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'RESET' }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not reset the scores.');
      setResetOpen(false);
      setResetConfirmation('');
      setMessage(`All scores cleared. ${payload.deletedEntries ?? 0} score history entries deleted; the event can start again.`);
      setExpanded({});
      setForms({});
      await load();
    } catch (cause) { setError(cause.message || 'Could not reset the scores.'); }
    finally { setBusy(''); }
  }

  const historyByTeam = useMemo(() => {
    const groups = Object.fromEntries(TEAMS.map((team) => [team.id, []]));
    for (const entry of data.entries) groups[entry.team_id]?.push(entry);
    return groups;
  }, [data.entries]);

  return <>
    <div className="page-intro">
      <div className="eyebrow">Event audit · {totalEventPoints.toLocaleString()} points</div>
      <h1>Score room</h1>
      <p>Each house has its own game-by-game totals. Open its history to inspect timestamped awards or record a signed correction.</p>
    </div>
    {message && <motion.div className="form-success" role="status" initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}>{message}</motion.div>}
    {error && <div className="form-error" role="alert">{error}</div>}
    <div className="score-manager-toolbar">
      <label className="filter-field"><span className="field-label">History filter</span><select className="field-select" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All games</option>{GAMES.map((game) => <option key={game.id} value={game.id}>{game.name}</option>)}</select></label>
      <button className="secondary-button" type="button" onClick={load} disabled={loading || Boolean(busy)}>Refresh scores</button>
      <a className="secondary-button" href="/finalize" target="_blank" rel="noreferrer">Preview public reveal</a>
    </div>
    <div className="reset-controls"><button className="danger-button" type="button" disabled={Boolean(busy) || loading} onClick={() => { setResetConfirmation(''); setResetOpen(true); }}>Reset all scores</button></div>
    {loading ? <div className="empty-state">Loading team scores…</div> : <div className="team-admin-list">
      {TEAMS.map((team, index) => {
        const entries = historyByTeam[team.id].filter((entry) => filter === 'all' || entry.game_id === filter);
        return <motion.section className="team-admin-panel" key={team.id} style={{ '--team-color': team.color }} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .035 }}>
          <div className="team-admin-heading"><div className="team-admin-crest"><img src={team.image} alt="" /></div><h2 className="team-admin-name">{team.name}</h2><div className="team-grand-total"><AnimatedNumber value={teamTotals[team.id]} /><small>event points</small></div></div>
          <div className="game-score-strip">{GAMES.map((game) => <div className="game-score-cell" key={game.id}><span>{game.name}</span><strong>{Number(data.totals.find((row) => row.team_id === team.id && row.game_id === game.id)?.total_points || 0).toLocaleString()}</strong></div>)}</div>
          <div className="team-panel-tools"><span className="history-meta">{entries.length} recorded {entries.length === 1 ? 'interaction' : 'interactions'}{filter !== 'all' ? ` · ${GAMES.find((g) => g.id === filter)?.name}` : ''}</span><button type="button" className="inline-button" aria-expanded={Boolean(expanded[team.id])} onClick={() => setExpanded((current) => ({ ...current, [team.id]: !current[team.id] }))}>{expanded[team.id] ? 'Close history and correction' : 'History / adjust score'}</button></div>
          <AnimatePresence initial={false}>{expanded[team.id] && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="team-panel-expanded">
            <div className="adjustment-form">{GAMES.filter((game) => filter === 'all' || game.id === filter).map((game) => {
              const key = `${team.id}:${game.id}`; const form = forms[key] || {};
              return <div className="adjustment-game" key={game.id}><strong>{game.name}</strong><label className="field-label" htmlFor={`delta-${key}`}>Signed points (e.g. −5 or +5)</label><input className="field-input" id={`delta-${key}`} inputMode="numeric" type="number" step="1" value={form.delta ?? ''} onChange={(event) => setForms((current) => ({ ...current, [key]: { ...current[key], delta: event.target.value } }))} /><label className="field-label" htmlFor={`note-${key}`}>Optional note</label><input className="field-input" id={`note-${key}`} value={form.note ?? ''} maxLength={500} onChange={(event) => setForms((current) => ({ ...current, [key]: { ...current[key], note: event.target.value } }))} placeholder="Reason for correction" /><button className="secondary-button" type="button" disabled={Boolean(busy)} onClick={() => submitAdjustment(team, game)}>{busy === key ? 'Saving…' : 'Save correction'}</button></div>;
            })}</div>
            <div className="history-list">{entries.length ? entries.map((entry) => <div className="history-entry" key={entry.id}><div className="history-title">{GAMES.find((game) => game.id === entry.game_id)?.name} · {entry.entry_type === 'award' ? 'Award' : 'Correction'}</div><div className={`history-delta${entry.points_delta < 0 ? ' negative' : ''}`}>{entry.points_delta > 0 ? '+' : ''}{entry.points_delta}</div><div className="history-meta">{formatTime(entry.created_at)} · {entry.actor}</div>{entry.note && <div className="history-note">{entry.note}</div>}</div>) : <div className="empty-state">No recorded interactions for this filter yet.</div>}</div>
          </motion.div>}</AnimatePresence>
        </motion.section>;
      })}
    </div>}
    <section className="finalize-controls"><div><div className="finalize-state"><span className="live-dot" />{data.finalization?.is_locked ? `Finalized ${data.finalization.locked_at ? `· ${formatTime(data.finalization.locked_at)}` : ''}` : 'Not finalized'}</div><p style={{ marginTop: 10 }}>Lock the event-wide top three for the public <strong>/finalize</strong> reveal. Any later adjustment automatically refreshes the announced results.</p></div><button className="primary-button" type="button" disabled={Boolean(busy) || loading} onClick={lockResults}>{busy === 'finalize' ? 'Finalizing…' : data.finalization?.is_locked ? 'Refresh final results' : 'Finalize event results'}</button></section>
    {data.finalizationEvents?.some((event) => event.action === 'reset') && <section className="reset-history"><h2>Reset history</h2>{data.finalizationEvents.filter((event) => event.action === 'reset').map((event, index) => <div className="history-entry" key={`${event.created_at}-${index}`}><div className="history-title">Scores cleared</div><div className="history-meta">{formatTime(event.created_at)} · {event.actor}</div></div>)}</section>}
    <AnimatePresence>{resetOpen && <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.form className="reset-dialog" role="dialog" aria-modal="true" aria-labelledby="reset-dialog-title" onSubmit={resetScores} initial={{ opacity: 0, y: 16, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: .98 }}>
        <div className="eyebrow">Irreversible event reset</div>
        <h2 id="reset-dialog-title">Clear every score?</h2>
        <p>This deletes all recorded score entries, resets every team and game total to zero, and unlocks the public final reveal. The reset itself will be recorded with your admin username and timestamp.</p>
        <label className="field-label" htmlFor="reset-confirmation">Type <span className="reset-confirm-word">RESET</span> to confirm</label>
        <input className="field-input" id="reset-confirmation" autoComplete="off" value={resetConfirmation} onChange={(event) => setResetConfirmation(event.target.value)} />
        <div className="reset-dialog-actions"><button className="secondary-button" type="button" disabled={busy === 'reset'} onClick={() => setResetOpen(false)}>Cancel</button><button className="danger-button" type="submit" disabled={busy === 'reset' || resetConfirmation.trim() !== 'RESET'}>{busy === 'reset' ? 'Resetting…' : 'Delete all scores'}</button></div>
      </motion.form>
    </motion.div>}</AnimatePresence>
  </>;
}
