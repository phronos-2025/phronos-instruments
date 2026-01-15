/**
 * Magic Link Modal
 * 
 * For anonymous-to-registered conversion
 */

import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Panel } from '../ui/Panel';
import { Button } from '../ui/Button';

interface MagicLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MagicLinkModal: React.FC<MagicLinkModalProps> = ({ isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Track if email is already registered (need to sign in instead)
  const [emailExists, setEmailExists] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setEmailExists(false);

    try {
      // Check if user is currently anonymous
      const { data: { user } } = await supabase.auth.getUser();

      if (user?.is_anonymous) {
        // For anonymous users, use updateUser to link email while preserving user ID
        // This keeps all existing games linked to this user
        const { error } = await supabase.auth.updateUser(
          { email },
          { emailRedirectTo: `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(window.location.pathname)}` }
        );

        if (error) {
          // Check if the error is because email already exists
          if (error.message.includes('already been registered') || error.message.includes('already exists')) {
            setEmailExists(true);
            return;
          }
          throw error;
        }
      } else {
        // For non-anonymous users (shouldn't happen but fallback)
        const returnPath = window.location.pathname;
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(returnPath)}`
          }
        });

        if (error) throw error;
      }

      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send magic link');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle sign-in for existing account
  const handleSignIn = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const returnPath = window.location.pathname;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(returnPath)}`
        }
      });

      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send magic link');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '2rem'
    }}>
      <div style={{ maxWidth: '500px', width: '100%' }}>
        <Panel title="Initialize ID">
          {sent ? (
            <div>
              <p style={{ marginBottom: '1rem', color: 'var(--faded)' }}>
                Check your email for a magic link to sign in.
              </p>
              <div className="btn-group">
                <Button variant="primary" onClick={onClose}>
                  Close
                </Button>
              </div>
            </div>
          ) : emailExists ? (
            <div>
              <p style={{ marginBottom: '1rem', color: 'var(--faded)' }}>
                An account with <strong style={{ color: 'var(--gold)' }}>{email}</strong> already exists.
              </p>
              <p style={{ marginBottom: '1rem', color: 'var(--faded)', fontSize: 'var(--text-sm)' }}>
                Sign in to access your existing profile. Note: this game session will not transfer to your account.
              </p>

              {error && (
                <div style={{ color: 'var(--alert)', marginBottom: '1rem', fontSize: 'var(--text-sm)' }}>
                  ◈ {error}
                </div>
              )}

              <div className="btn-group">
                <Button
                  variant="primary"
                  onClick={handleSignIn}
                  disabled={isLoading}
                >
                  {isLoading ? 'Sending...' : 'Sign In Instead'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEmailExists(false);
                    setEmail('');
                  }}
                >
                  Use Different Email
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <p style={{ marginBottom: '1rem', color: 'var(--faded)' }}>
                Convert your anonymous account to a registered account to save your profile.
              </p>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="clue-input"
                style={{ width: '100%', marginBottom: '1rem' }}
                required
                disabled={isLoading}
              />

              {error && (
                <div style={{ color: 'var(--alert)', marginBottom: '1rem', fontSize: 'var(--text-sm)' }}>
                  ◈ {error}
                </div>
              )}

              <div className="btn-group">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!email || isLoading}
                >
                  {isLoading ? 'Sending...' : 'Send Magic Link'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onClose}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </Panel>
      </div>
    </div>
  );
};
