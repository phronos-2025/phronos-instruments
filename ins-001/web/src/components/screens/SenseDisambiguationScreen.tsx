/**
 * Sense Disambiguation Screen
 * 
 * Handle polysemous words (e.g., "bat" = flying mammal vs sports equipment)
 */

import React, { useState } from 'react';
import { useGameState } from '../../lib/state';
import { api } from '../../lib/api';
import { Panel } from '../ui/Panel';
import { Button } from '../ui/Button';
import { ProgressBar } from '../ui/ProgressBar';

interface SenseDisambiguationScreenProps {
  seedWord: string;
  senseOptions: string[];
}

export const SenseDisambiguationScreen: React.FC<SenseDisambiguationScreenProps> = ({
  seedWord,
  senseOptions
}) => {
  const { dispatch } = useGameState();
  const [selectedSense, setSelectedSense] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const handleSubmit = async () => {
    if (!selectedSense) return;
    
    setIsSubmitting(true);
    
    try {
      const response = await api.games.create({
        seed_word: seedWord,
        seed_word_sense: selectedSense,
        recipient_type: 'human' // Human by default, LLM triggered on demand
      });
      
      dispatch({
        type: 'SENSE_SELECTED',
        gameId: response.game_id,
        noiseFloor: response.noise_floor,
        seedWord: seedWord
      });
    } catch (err) {
      console.error('Failed to create game with sense:', err);
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div>
      <ProgressBar currentStep={1} />
      
      <Panel title="Clarify Meaning">
        <p style={{ marginBottom: '1.5rem', color: 'var(--faded)' }}>
          The word <strong style={{ color: 'var(--gold)' }}>"{seedWord}"</strong> has multiple meanings. Which one do you mean?
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {senseOptions.map((sense, idx) => (
            <label
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                border: '1px solid var(--faded-light)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                backgroundColor: selectedSense === sense ? 'var(--gold-dim)' : 'transparent'
              }}
              onClick={() => setSelectedSense(sense)}
            >
              <input
                type="radio"
                name="sense"
                value={sense}
                checked={selectedSense === sense}
                onChange={() => setSelectedSense(sense)}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ color: 'var(--text-light)' }}>{sense}</span>
            </label>
          ))}
        </div>
        
        <div className="btn-group">
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!selectedSense || isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'Continue'}
          </Button>
        </div>
      </Panel>
    </div>
  );
};
