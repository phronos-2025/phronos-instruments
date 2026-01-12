/**
 * Seed Screen
 * 
 * Single text input, any word allowed
 */

import React, { useState } from 'react';
import { useGameState } from '../../lib/state';
import { api } from '../../lib/api';
import { Panel } from '../ui/Panel';
import { Button } from '../ui/Button';
import { ProgressBar } from '../ui/ProgressBar';

export const SeedScreen: React.FC = () => {
  const { dispatch } = useGameState();
  const [seedWord, setSeedWord] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seedWord.trim()) return;
    
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
              disabled={!seedWord.trim() || isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Continue'}
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  );
};
