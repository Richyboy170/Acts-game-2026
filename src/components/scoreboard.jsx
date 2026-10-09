'use client';

import { AnimatePresence, animate, motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatedNumber } from '@/components/animated-number.jsx';
import { PHASE_BACKGROUNDS, TEAMS } from '@/lib/catalog.js';
import { PHASE_THRESHOLDS, aggregateTeamTotals, getGaugeState, getPhaseForScore, getTeamBarFillPercent } from '@/lib/scoreboard.js';
import { getBrowserSupabase } from '@/lib/supabase/browser.js';

const GAME_IDS = ['sandwich', 'balloon-direction', 'water-cup', 'get-the-ball-off'];
const INITIAL_ROWS = GAME_IDS.flatMap((gameId) => TEAMS.map((team) => ({
  game_id: gameId,
  team_id: team.id,
  total_points: 0,
})));

function DustField() {
  const motes = useMemo(() => Array.from({ length: 34 }, (_, index) => ({
    x: `${(index * 37 + 9) % 100}%`,
    y: `${(index * 61 + 7) % 100}%`,
    size: `${2 + (index % 3)}px`,
    duration: `${15 + (index % 11) * 1.7}s`,
    delay: `${-((index * 7) % 29)}s`,
    drift: `${(index % 2 ? 1 : -1) * (14 + (index % 5) * 9)}px`,
  })), []);

  return (
    <div className="magic-atmosphere" aria-hidden="true">
      <span className="magic-light one" />
      <span className="magic-light two" />
      <span className="rune-orbit" />
      <div className="dust-field">
        {motes.map((mote, index) => <i key={index} style={{ '--x': mote.x, '--y': mote.y, '--size': mote.size, '--duration': mote.duration, '--delay': mote.delay, '--drift': mote.drift }} />)}
      </div>
    </div>
  );
}

function TeamRow({ team, total, teamTotals, side, hidden, onToggle, registerSeal }) {
  const fillPercent = getTeamBarFillPercent(total, teamTotals);
  const details = (
    <div className="team-details">
      <AnimatePresence initial={false}>
        {!hidden && (
        <motion.div
          key="team-details"
          className="team-details-content"
          initial={{ opacity: 0, scaleX: 0.84, filter: 'blur(4px)' }}
          animate={{ opacity: 1, scaleX: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, scaleX: 0.72, filter: 'blur(3px)' }}
          transition={{ duration: 0.38, ease: [0.18, 0.68, 0.24, 1] }}
          style={{ transformOrigin: side === 'left' ? 'left' : 'right' }}
        >
          <div className="team-name-line">
            <span className="team-name">{team.name}</span>
            {total > 0 && <span className="team-rank">Contributing</span>}
          </div>
          <div className="team-bar-track" aria-label={`${team.name}: ${total} points`}>
            <motion.div
              className="team-bar-fill"
              style={{ '--team-color': team.color }}
              initial={false}
              animate={{ width: `${fillPercent}%` }}
              transition={{ type: 'spring', stiffness: 74, damping: 19, mass: 0.8 }}
            />
          </div>
          <div className="team-score">
            <AnimatedNumber value={total} />
            <span className="team-score-label">points</span>
          </div>
        </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  const seal = (
    <button
      ref={(element) => registerSeal(team.id, element)}
      type="button"
      className={`team-seal-button${hidden ? ' is-hidden' : ''}`}
      style={{ '--team-color': team.color }}
      aria-label={`${hidden ? 'Show' : 'Hide'} ${team.name} team score`}
      aria-pressed={!hidden}
      onClick={() => onToggle(team.id)}
    >
      <img src={team.image} alt="" />
    </button>
  );

  return (
    <div className={`team-row ${side}`}>
      {side === 'left' ? <>{seal}{details}</> : <>{details}{seal}</>}
    </div>
  );
}

function FullscreenButton() {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const update = () => setActive(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setActive(Boolean(document.fullscreenElement));
    }
  }

  return (
    <button className="fullscreen-button" type="button" onClick={toggleFullscreen} aria-label={active ? 'Exit full screen' : 'Enter full screen'}>
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d={active ? 'M7 3v4H3M13 17v-4h4M3 13h4v4M17 7h-4V3' : 'M3 8V3h5M17 8V3h-5M3 12v5h5M17 12v5h-5'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      <span>{active ? 'Exit screen' : 'Full screen'}</span>
    </button>
  );
}

function colorGradient(teamTotals) {
  const positive = TEAMS.map((team) => ({ ...team, total: teamTotals[team.id] ?? 0 })).filter((team) => team.total > 0);
  if (!positive.length) return 'linear-gradient(to top, rgba(217,181,106,.14), rgba(217,181,106,.14))';
  const totalPoints = positive.reduce((sum, team) => sum + team.total, 0);
  let current = 0;
  const stops = positive.map((team) => {
    const start = (current / totalPoints) * 100;
    current += team.total;
    const end = (current / totalPoints) * 100;
    return `${team.color} ${start.toFixed(2)}%, ${team.color} ${end.toFixed(2)}%`;
  });
  return `linear-gradient(to top, ${stops.join(', ')})`;
}

export function Scoreboard() {
  const client = useMemo(() => getBrowserSupabase(), []);
  const [rows, setRows] = useState(INITIAL_ROWS);
  const rowsRef = useRef(INITIAL_ROWS);
  const [connection, setConnection] = useState(client ? 'connecting' : 'offline');
  const [hiddenTeams, setHiddenTeams] = useState([]);
  const [flights, setFlights] = useState([]);
  const [pulseId, setPulseId] = useState(0);
  const [milestonePhase, setMilestonePhase] = useState(null);
  const sealRefs = useRef({});
  const meterRef = useRef(null);
  const reducedMotion = useReducedMotion();

  const refreshTotals = useCallback(async () => {
    if (!client) return;
    const { data, error } = await client.from('team_score_totals').select('game_id, team_id, total_points');
    if (error || !data) {
      setConnection('offline');
      return;
    }
    const completeRows = INITIAL_ROWS.map((initial) => {
      const found = data.find((row) => row.game_id === initial.game_id && row.team_id === initial.team_id);
      return found ? { ...initial, ...found } : initial;
    });
    rowsRef.current = completeRows;
    setRows(completeRows);
    setConnection('live');
  }, [client]);

  const createFlight = useCallback((teamId, delta) => {
    setPulseId((current) => current + 1);
    if (reducedMotion) return;
    const origin = sealRefs.current[teamId]?.getBoundingClientRect();
    const target = meterRef.current?.getBoundingClientRect();
    if (!origin || !target) return;
    const id = `${teamId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const flight = {
      id,
      label: `${delta > 0 ? '+' : '−'}${new Intl.NumberFormat('en-US').format(Math.abs(delta))}`,
      negative: delta < 0,
      from: { left: origin.left + origin.width / 2, top: origin.top + origin.height / 2 },
      to: { left: target.left + target.width / 2, top: target.top + target.height / 2 },
    };
    setFlights((current) => [...current.slice(-4), flight]);
    window.setTimeout(() => setFlights((current) => current.filter((item) => item.id !== id)), 1450);
  }, [reducedMotion]);

  useEffect(() => {
    if (!client) return undefined;
    refreshTotals();
    const channel = client
      .channel('acts-scoreboard-live')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'team_score_totals' }, (payload) => {
        const updated = payload.new;
        if (!updated?.game_id || !updated?.team_id) return;
        const key = `${updated.game_id}:${updated.team_id}`;
        const previous = rowsRef.current.find((row) => `${row.game_id}:${row.team_id}` === key);
        const delta = Number(updated.total_points) - Number(previous?.total_points ?? 0);
        const nextRows = rowsRef.current.map((row) => `${row.game_id}:${row.team_id}` === key ? { ...row, ...updated } : row);
        rowsRef.current = nextRows;
        setRows(nextRows);
        if (delta !== 0) createFlight(updated.team_id, delta);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnection('live');
          refreshTotals();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setConnection('offline');
        }
      });
    return () => { client.removeChannel(channel); };
  }, [client, createFlight, refreshTotals]);

  const teamTotals = useMemo(() => {
    const summed = aggregateTeamTotals(rows, TEAMS.map((team) => team.id));
    return Object.fromEntries(summed.map(({ teamId, total }) => [teamId, total]));
  }, [rows]);
  const eventTotal = Object.values(teamTotals).reduce((sum, score) => sum + score, 0);
  const phase = getPhaseForScore(eventTotal);
  const gauge = getGaugeState(eventTotal);
  const teamScores = TEAMS.map((team) => teamTotals[team.id] ?? 0);
  const blendedGradient = colorGradient(teamTotals);
  const previousPhaseRef = useRef(phase);

  useEffect(() => {
    if (phase > previousPhaseRef.current) {
      setMilestonePhase(phase);
      const timeout = window.setTimeout(() => setMilestonePhase(null), 2600);
      previousPhaseRef.current = phase;
      return () => window.clearTimeout(timeout);
    }
    previousPhaseRef.current = phase;
    return undefined;
  }, [phase]);

  function toggleTeam(teamId) {
    setHiddenTeams((current) => current.includes(teamId) ? current.filter((id) => id !== teamId) : [...current, teamId]);
  }

  function registerSeal(teamId, element) {
    if (element) sealRefs.current[teamId] = element;
    else delete sealRefs.current[teamId];
  }

  const leftTeams = TEAMS.slice(0, 4);
  const rightTeams = TEAMS.slice(4);
  return (
    <main className="scoreboard" aria-label="Live team scoreboard">
      <div className="scoreboard-backgrounds" aria-hidden="true">
        <AnimatePresence initial={false}>
          <motion.div
            key={phase}
            className="scoreboard-background"
            style={{ backgroundImage: `url("${PHASE_BACKGROUNDS[phase]}")` }}
            initial={{ opacity: 0, scale: 1.055 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.025 }}
            transition={{ opacity: { duration: 1.1 }, scale: { duration: 14, ease: 'linear' } }}
          />
        </AnimatePresence>
      </div>
      <DustField />

      <header className="scoreboard-header">
        <div className={`live-indicator ${connection === 'live' ? '' : 'is-offline'}`} aria-live="polite">
          <span className="live-dot" />
          <span>{connection === 'live' ? 'Live scores' : connection === 'connecting' ? 'Connecting' : 'Score link offline'}</span>
        </div>
        <div className="scoreboard-brand">
          <span className="eyebrow">The Acts House Cup</span>
          <h1 className="scoreboard-title">TEAM BUILDING</h1>
          <p className="scoreboard-subtitle">Four trials · Eight houses · One cup</p>
        </div>
        <FullscreenButton />
      </header>

      <div className="scoreboard-main">
        <section className="team-column left" aria-label="Teams one through four">
          {leftTeams.map((team) => (
            <TeamRow key={team.id} team={team} total={teamTotals[team.id] ?? 0} teamTotals={teamScores} side="left" hidden={hiddenTeams.includes(team.id)} onToggle={toggleTeam} registerSeal={registerSeal} />
          ))}
        </section>

        <section className="center-meter" aria-label={`Combined score ${eventTotal}; phase ${phase}`}>
          <div className="meter-heading">Combined score</div>
          <div className="meter-total"><AnimatedNumber value={eventTotal} duration={0.9} /><span className="meter-live-caption">Event points</span></div>
          <div className="meter-shell">
            <div className="meter-ticks" aria-hidden="true">
              {PHASE_THRESHOLDS.map((threshold) => (
                <div key={threshold} className="meter-tick" style={{ bottom: `${Math.min(100, (threshold / gauge.maximum) * 100)}%` }}>
                  <span className="meter-tick-label">{new Intl.NumberFormat('en-US').format(threshold)}</span>
                </div>
              ))}
            </div>
            <div className="meter-glow" />
            <div className="meter-track" ref={meterRef} role="progressbar" aria-label="Combined event points" aria-valuemin={0} aria-valuemax={gauge.maximum} aria-valuenow={eventTotal}>
              <motion.div className="meter-fill" style={{ background: blendedGradient }} animate={{ height: `${gauge.fillPercent}%` }} transition={{ type: 'spring', stiffness: 46, damping: 20, mass: 1.1 }} />
              <span className="meter-crown" aria-hidden="true">✦</span>
              <AnimatePresence>{pulseId > 0 && <motion.span key={pulseId} className="impact-ring" initial={{ opacity: .85, scale: .3 }} animate={{ opacity: 0, scale: 2.8 }} exit={{ opacity: 0 }} transition={{ duration: .85, ease: 'easeOut' }} />}</AnimatePresence>
            </div>
          </div>
          <div className="meter-caption">Reward meter · Phase {phase}</div>
        </section>

        <section className="team-column right" aria-label="Teams five through eight">
          {rightTeams.map((team) => (
            <TeamRow key={team.id} team={team} total={teamTotals[team.id] ?? 0} teamTotals={teamScores} side="right" hidden={hiddenTeams.includes(team.id)} onToggle={toggleTeam} registerSeal={registerSeal} />
          ))}
        </section>
      </div>

      <footer className="scoreboard-footer"><span className="footer-star">✧</span> Earn every point together <span className="footer-star">✧</span></footer>

      <AnimatePresence>
        {flights.map((flight) => (
          <motion.div
            key={flight.id}
            className={`contribution-flight${flight.negative ? ' negative' : ''}`}
            initial={{ left: flight.from.left, top: flight.from.top, opacity: 0, scale: .55 }}
            animate={{ left: flight.to.left, top: flight.to.top, opacity: [0, 1, 1, 0], scale: [.55, 1.18, .95, .35] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.25, ease: [0.2, 0.72, 0.25, 1] }}
          >
            {flight.label} pts
          </motion.div>
        ))}
      </AnimatePresence>
      <AnimatePresence>
        {milestonePhase && (
          <motion.div className="milestone-overlay" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0] }} exit={{ opacity: 0 }} transition={{ duration: 2.5, times: [0, .18, 1] }} aria-live="polite">
            <motion.div className="milestone-plaque" initial={{ y: 25, scale: .8 }} animate={{ y: [25, 0, -8], scale: [ .8, 1.04, 1 ] }} transition={{ duration: .8, ease: 'easeOut' }}>
              A new chapter awakens<strong>PHASE {milestonePhase}</strong>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {connection === 'offline' && <div className="scoreboard-connect-notice" role="status">Waiting for the Supabase score connection</div>}
    </main>
  );
}
