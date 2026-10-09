'use client';

import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PHASE_BACKGROUNDS, TEAMS, TEAM_BY_ID } from '@/lib/catalog.js';
import { aggregateTeamTotals, getPhaseForScore } from '@/lib/scoreboard.js';
import { getBrowserSupabase } from '@/lib/supabase/browser.js';

export function FinalizeReveal() {
  const client = useMemo(() => getBrowserSupabase(), []);
  const [totals, setTotals] = useState([]);
  const [state, setState] = useState({ is_locked: false, results: [] });
  const reduceMotion = useReducedMotion();

  const refresh = useCallback(async () => {
    if (!client) return;
    const [{ data: totalRows }, { data: finalState }] = await Promise.all([
      client.from('team_score_totals').select('game_id, team_id, total_points'),
      client.from('event_finalization_state').select('is_locked, results, locked_at').eq('id', true).maybeSingle(),
    ]);
    if (totalRows) setTotals(totalRows);
    if (finalState) setState(finalState);
  }, [client]);

  useEffect(() => {
    if (!client) return undefined;
    refresh();
    const channel = client.channel('acts-final-reveal')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_finalization_state' }, refresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'team_score_totals' }, refresh)
      .subscribe((status) => { if (status === 'SUBSCRIBED') refresh(); });
    return () => { client.removeChannel(channel); };
  }, [client, refresh]);

  const totalScore = aggregateTeamTotals(totals, TEAMS.map((team) => team.id)).reduce((sum, team) => sum + team.total, 0);
  const phase = getPhaseForScore(totalScore);
  const winners = (state.results || []).map((row) => ({ ...row, team: TEAM_BY_ID[row.team_id] })).filter((row) => row.team);
  const podium = [...winners].sort((a, b) => a.rank - b.rank);
  const podiumGroups = [...new Set(podium.map((row) => row.rank))].map((rank) => ({
    rank,
    teams: podium.filter((row) => row.rank === rank),
  }));

  return <main className="reveal-page">
    <div className="reveal-backdrop" style={{ backgroundImage: `url("${PHASE_BACKGROUNDS[phase]}")` }} />
    <div className="reveal-magic" aria-hidden="true"><i /><i /><i /><span>✧　·　✦　·　✧</span></div>
    <div className="reveal-content">
      <h1 className="reveal-title">The House Cup</h1>
      <p className="reveal-subtitle">{state.is_locked
        ? 'Thank you, everyone. Every contribution mattered—and congratulations to our top three for giving their best.'
        : 'Every contribution matters. Thank you, teams, for bringing your best.'}</p>
      <AnimatePresence mode="wait">
        {state.is_locked ? <motion.section key="podium" className="podium" aria-label="Top three teams" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ staggerChildren: .15 }}>
          {podiumGroups.map(({ rank, teams }, index) => <motion.article key={rank} className={`podium-card rank-${rank}${rank === 1 ? ' first' : ''}${teams.length > 1 ? ' tied' : ''}`} initial={reduceMotion ? false : { opacity: 0, y: 50, scale: .92 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: index * .22, type: 'spring', stiffness: 70, damping: 14 }}>
            <div className="podium-place">{rank === 1 ? 'Champion' : `${rank}${rank === 2 ? 'nd' : 'rd'} Place`}{teams.length > 1 ? ' · Tied' : ''}</div><div className="podium-crown" aria-hidden="true">{rank === 1 ? '✦' : '✧'}</div><div className={`podium-teams${teams.length > 1 ? ' has-ties' : ''}`}>
              {teams.map((row) => <div className="podium-team" key={row.team_id} style={{ '--team-color': row.team.color }}><div className="podium-crest"><img src={row.team.image} alt={`${row.team.name} crest`} /></div><h2 className="podium-team-name">{row.team_name || row.team.name}</h2></div>)}
            </div><div className="podium-pedestal" />
          </motion.article>)}
        </motion.section> : <motion.section key="waiting" className="reveal-waiting" initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.04 }}><span className="waiting-star" aria-hidden="true">✧</span><h2>The final reveal awaits</h2><p>The event-wide results will appear here once the admins complete all four trials and lock the top three teams.</p></motion.section>}
      </AnimatePresence>
      <div className="reveal-phase">Current hall display · Phase {phase}</div>
      <Link className="reveal-back-link" href="/">Return to the live hall display</Link>
    </div>
    <div className="reveal-sparks" aria-hidden="true">{Array.from({ length: 22 }, (_, i) => <i key={i} style={{ left: `${(i * 47 + 11) % 100}%`, top: `${(i * 71 + 8) % 100}%`, '--spark-index': i }} />)}</div>
  </main>;
}
