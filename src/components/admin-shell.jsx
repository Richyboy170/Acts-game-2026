'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';

function LoginPanel({ configured, onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not sign in.');
      onLogin(payload.username);
    } catch (submitError) {
      setError(submitError.message || 'Could not sign in. Check the connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.section className="admin-card login-card" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .45 }}>
      <div className="eyebrow">Private admin access</div>
      <h1>Enter the score room</h1>
      <p className="login-copy">Sign in with your admin username and the shared admin password to award points, review history, and prepare the final reveal.</p>
      {!configured && <div className="setup-notice">Admin login is not configured yet. Copy <code>.env.example</code> to <code>.env.local</code>, add a comma-separated list in <code>ADMIN_USERNAMES</code>, one shared password, and a generated session secret, then restart the app.</div>}
      <form onSubmit={submit}>
        <label className="field-label" htmlFor="admin-username">Username</label>
        <input className="field-input" id="admin-username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required />
        <label className="field-label" htmlFor="admin-password">Password</label>
        <input className="field-input" id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button button-full" type="submit" disabled={busy || !configured}>{busy ? 'Checking credentials…' : 'Unlock admin'}</button>
      </form>
      <p className="login-footnote">The public scoreboard stays open at <Link href="/">the hall display</Link>.</p>
    </motion.section>
  );
}

export function AdminShell({ children }) {
  const [status, setStatus] = useState('checking');
  const [configured, setConfigured] = useState(false);
  const [username, setUsername] = useState(null);

  const checkSession = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/session', { cache: 'no-store' });
      const payload = await response.json();
      setConfigured(Boolean(payload.configured));
      setUsername(payload.username ?? null);
      setStatus(payload.authenticated ? 'authenticated' : 'signed-out');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => { checkSession(); }, [checkSession]);

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    setUsername(null);
    setStatus('signed-out');
  }

  return (
    <main className="admin-page">
      <div className="admin-backdrop" style={{ backgroundImage: 'url("/assets/background-phase/phase1.jpg")' }} />
      <div className="admin-content">
        <header className="admin-topbar">
          <Link className="admin-brand" href="/admin"><span className="brand-mark">✦</span><span>ACTS HOUSE CUP</span></Link>
          {status === 'authenticated' && (
            <nav className="admin-nav" aria-label="Admin navigation">
              <Link className="nav-link" href="/admin">Games</Link>
              <Link className="nav-link" href="/admin-score">Score room</Link>
              <button className="logout-button" type="button" onClick={logout} aria-label={`Sign out ${username ?? 'admin'}`}>Sign out</button>
            </nav>
          )}
        </header>

        {status === 'checking' && <div className="empty-state">Checking admin access…</div>}
        {status === 'error' && <div className="form-error" role="alert">Could not reach the admin session endpoint. Check the app server and try again.</div>}
        {status === 'signed-out' && <LoginPanel configured={configured} onLogin={(name) => { setUsername(name); setStatus('authenticated'); }} />}
        <AnimatePresence mode="wait">
          {status === 'authenticated' && <motion.div key="admin-content" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .28 }}>{children}</motion.div>}
        </AnimatePresence>
      </div>
    </main>
  );
}
