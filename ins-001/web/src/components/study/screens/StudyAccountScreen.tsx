/**
 * Study Account Screen
 *
 * Email registration or login. After auth, enrolls in study and proceeds to consent.
 */

import React, { useState, useEffect } from 'react';
import { useStudy } from '../../../lib/study-state';
import { useAuth } from '../../auth/AuthProvider';
import { api } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';
import { Panel } from '../../ui/Panel';
import { Button } from '../../ui/Button';

export function StudyAccountScreen() {
  const { state, dispatch } = useStudy();
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // If user becomes authenticated, proceed
  useEffect(() => {
    if (user && user.email) {
      handlePostAuth();
    }
  }, [user]);

  const handlePostAuth = async () => {
    try {
      const enrollment = await api.studies.enroll(state.slug);
      dispatch({
        type: 'ENROLLED',
        enrollmentId: enrollment.enrollment_id,
        itemsCompleted: enrollment.items_completed ?? enrollment.games_completed,
      });
      dispatch({ type: 'GO_TO', screen: 'consent' });
    } catch (e: any) {
      dispatch({ type: 'ERROR', message: e.message });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      if (mode === 'signup') {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/studies/${state.slug}`,
          },
        });
        if (signUpError) throw signUpError;
        setMessage('Check your email for a confirmation link, then return to this page.');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        // Auth state change will trigger handlePostAuth via useEffect
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="study-container">
      <h2 className="title" style={{ fontSize: '1.8rem' }}>Create an Account</h2>

      <p className="description" style={{ maxWidth: '500px', margin: '0 auto var(--space-lg)' }}>
        Your account saves your scores across all games and lets you see how you compare to other participants.
      </p>

      <Panel style={{ maxWidth: '400px', margin: '0 auto' }}>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 'var(--space-md)' }}>
            <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--faded)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 'var(--space-xs)' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              style={{
                width: '100%',
                padding: 'var(--space-sm)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8rem',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--faded-light)',
                color: 'var(--text-light)',
              }}
            />
          </div>

          <div style={{ marginBottom: 'var(--space-md)' }}>
            <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--faded)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 'var(--space-xs)' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="At least 6 characters"
              style={{
                width: '100%',
                padding: 'var(--space-sm)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8rem',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--faded-light)',
                color: 'var(--text-light)',
              }}
            />
          </div>

          {error && (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: '#ff6b6b', marginBottom: 'var(--space-sm)' }}>
              {error}
            </p>
          )}

          {message && (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--active)', marginBottom: 'var(--space-sm)' }}>
              {message}
            </p>
          )}

          <Button variant="primary" type="submit" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Working...' : mode === 'signup' ? 'Create Account' : 'Log In'}
          </Button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 'var(--space-md)' }}>
          <button
            onClick={() => setMode(mode === 'signup' ? 'login' : 'signup')}
            style={{
              background: 'none',
              border: 'none',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.65rem',
              color: 'var(--gold)',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            {mode === 'signup' ? 'Already have an account? Log in' : 'Need an account? Sign up'}
          </button>
        </div>
      </Panel>
    </div>
  );
}
