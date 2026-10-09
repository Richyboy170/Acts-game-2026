'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { GAMES } from '@/lib/catalog.js';

export function AdminHome() {
  return (
    <>
      <div className="page-intro">
        <div className="eyebrow">Choose a trial</div>
        <h1>Where are we scoring?</h1>
        <p>Choose the game, then add points to the team that earned them. Every award is timestamped and included in the event total.</p>
      </div>
      <div className="game-grid">
        {GAMES.map((game, index) => (
          <motion.div key={game.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .07 }} whileHover={{ y: -3 }}>
            <Link className="game-card" href={`/admin/${game.id}`}>
              <span className="game-card-icon" aria-hidden="true">{game.icon}</span>
              <span><h2>{game.name}</h2><p>{game.description}</p></span>
              <span className="game-card-arrow" aria-hidden="true">↗</span>
            </Link>
          </motion.div>
        ))}
      </div>
      <div className="admin-actions">
        <Link className="secondary-button" href="/admin-score">Review team scores &amp; history</Link>
        <Link className="secondary-button" href="/finalize">Preview event reveal</Link>
      </div>
    </>
  );
}
