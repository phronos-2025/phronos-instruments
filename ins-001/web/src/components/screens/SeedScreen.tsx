/**
 * Seed Screen
 * 
 * Single text input, any word allowed
 */

import React, { useState, useEffect } from 'react';
import { useGameState } from '../../lib/state';
import { api } from '../../lib/api';
import { getParticipant } from '../../lib/participant';
import { Panel } from '../ui/Panel';
import { Button } from '../ui/Button';
import { ProgressBar } from '../ui/ProgressBar';

export const SeedScreen: React.FC = () => {
  const { dispatch } = useGameState();
  const [seedWord, setSeedWord] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestAttempt, setSuggestAttempt] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  
  // Ensure a participant id exists before the first game action. Minting is
  // idempotent and cached, so this just warms it; the API call would mint anyway.
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!authReady) {
        console.warn('Participant initialization timeout');
        setError('Setup is taking longer than expected. You can try to continue.');
        setAuthReady(true);
      }
    }, 5000);

    getParticipant()
      .catch((err) => {
        console.error('Participant setup error:', err);
        setError(`Failed to initialize: ${err instanceof Error ? err.message : 'Unknown error'}`);
      })
      .finally(() => {
        setAuthReady(true);
        clearTimeout(timeout);
      });

    return () => clearTimeout(timeout);
  }, [authReady]);
  
  const handleSuggest = async () => {
    setIsSuggesting(true);
    try {
      const response = await api.games.suggest(suggestAttempt);
      setSeedWord(response.suggestion);
      setSuggestAttempt((a) => a + 1);
    } catch (err) {
      console.error('Suggest failed:', err);
    } finally {
      setIsSuggesting(false);
    }
  };

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
      
      <p className="subtitle">
        <span className="id">INS-001.1</span> · Step 1 of 3
      </p>
      <h1 className="title">Choose your word.</h1>
      
      <p className="description">
        Pick any word as your target. This is the concept you will communicate through associations.
      </p>
      
      <div className="input-group">
        <label className="input-label">Target Word</label>
        {!authReady ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--faded)' }}>
            Initializing...
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              className="text-input"
              value={seedWord}
              onChange={(e) => setSeedWord(e.target.value)}
              placeholder="coffee"
              autoComplete="off"
              spellCheck="false"
              autoFocus
              disabled={isSubmitting}
            />
            <button
              type="button"
              onClick={handleSuggest}
              disabled={isSuggesting || isSubmitting}
              style={{
                marginTop: 'var(--space-xs)',
                background: 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--faded)',
                padding: '0.5rem 1rem',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
                borderRadius: '4px',
              }}
            >
              {isSuggesting ? '...' : 'Suggest'}
            </button>
            <p className="input-hint">
              Any word works: common words, technical terms, proper nouns, slang.
            </p>
            
            {error && (
              <div style={{ color: 'var(--alert)', marginTop: '1rem', fontSize: 'var(--text-sm)' }}>
                ◈ {error}
              </div>
            )}
            
            <div className="btn-group">
              <Button
                variant="ghost"
                onClick={() => dispatch({ type: 'RESET' })}
                type="button"
              >
                ← Back
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={!seedWord.trim() || isSubmitting || !authReady}
              >
                {isSubmitting ? 'Creating...' : 'Continue →'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
