/**
 * Seed Screen
 * 
 * Single text input, any word allowed
 */

import React, { useState, useEffect } from 'react';
import { useGameState } from '../../lib/state';
import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { Panel } from '../ui/Panel';
import { Button } from '../ui/Button';
import { ProgressBar } from '../ui/ProgressBar';

export const SeedScreen: React.FC = () => {
  const { dispatch } = useGameState();
  const [seedWord, setSeedWord] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  
  // Ensure user is authenticated (anonymous is fine)
  useEffect(() => {
    const ensureAuth = async () => {
      try {
        // Check for existing session first
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          setError(`Session error: ${sessionError.message}`);
          setAuthReady(true); // Allow user to try anyway
          return;
        }
        
        if (!session) {
          // Sign in anonymously if no session
          console.log('No session found, signing in anonymously...');
          const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
          
          if (authError) {
            console.error('Auth error:', authError);
            setError(`Authentication failed: ${authError.message}. You can still try to continue.`);
            setAuthReady(true); // Allow user to try anyway - API will handle auth
            return;
          }
          
          if (!authData.session) {
            console.error('No session after anonymous sign-in');
            setError('Failed to create anonymous session. Please refresh the page.');
            setAuthReady(true); // Allow user to try anyway
            return;
          }
          
          console.log('Anonymous sign-in successful');
        } else {
          console.log('Existing session found');
        }
        
        setAuthReady(true);
      } catch (err) {
        console.error('Auth setup error:', err);
        setError(`Failed to initialize: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setAuthReady(true); // Allow user to try anyway
      }
    };
    
    // Add timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      if (!authReady) {
        console.warn('Auth initialization timeout');
        setError('Authentication is taking longer than expected. You can try to continue.');
        setAuthReady(true);
      }
    }, 5000); // 5 second timeout
    
    ensureAuth().finally(() => {
      clearTimeout(timeout);
    });
  }, [authReady]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seedWord.trim() || !authReady) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const response = await api.games.create({
        seed_word: seedWord.trim(),
        recipient_type: 'llm' // Default to LLM for now
      });
      
      if (response.is_polysemous && response.sense_options) {
        dispatch({
          type: 'SEED_SUBMITTED',
          seedWord: seedWord.trim(),
          isPolysemous: true,
          senseOptions: response.sense_options
        });
      } else {
        dispatch({
          type: 'SEED_SUBMITTED',
          seedWord: seedWord.trim(),
          isPolysemous: false,
          gameId: response.game_id,
          noiseFloor: response.noise_floor
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create game');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div>
      <ProgressBar currentStep={1} />
      
      <Panel title="Step 1: Choose Your Word">
        <p style={{ marginBottom: '1rem', color: 'var(--faded)' }}>
          Enter any word. It can be a standard word, proper noun, domain term, or even a made-up word.
        </p>
        
        {!authReady ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--faded)' }}>
            Initializing...
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              value={seedWord}
              onChange={(e) => setSeedWord(e.target.value)}
              placeholder="Enter seed word..."
              className="clue-input"
              style={{ width: '100%', marginBottom: '1rem' }}
              autoFocus
              disabled={isSubmitting}
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
                disabled={!seedWord.trim() || isSubmitting || !authReady}
              >
                {isSubmitting ? 'Creating...' : 'Continue'}
              </Button>
            </div>
          </form>
        )}
      </Panel>
    </div>
  );
};
