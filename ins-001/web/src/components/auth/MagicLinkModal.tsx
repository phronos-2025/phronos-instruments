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
  
  if (!isOpen) return null;
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin
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
                Check your email for a magic link to convert your anonymous account to a registered account.
              </p>
              <div className="btn-group">
                <Button variant="primary" onClick={onClose}>
                  Close
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
