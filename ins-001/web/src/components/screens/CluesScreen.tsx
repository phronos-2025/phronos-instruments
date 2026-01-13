/**
 * Clues Screen
 * 
 * Noise floor visualization, 5 clue inputs (no validation - accepts any word)
 */

import React, { useState } from 'react';
import { useGameState } from '../../lib/state';
import { api } from '../../lib/api';
import type { NoiseFloorWord } from '../../lib/api';
import { Panel } from '../ui/Panel';
import { Button } from '../ui/Button';
import { ProgressBar } from '../ui/ProgressBar';
import { NoiseFloor } from '../ui/NoiseFloor';
import { ClueInput } from '../ui/ClueInput';

interface CluesScreenProps {
  gameId: string;
  noiseFloor: NoiseFloorWord[];
  seedWord: string;
}

export const CluesScreen: React.FC<CluesScreenProps> = ({
  gameId,
  noiseFloor,
  seedWord
}) => {
  const { dispatch } = useGameState();
  const [clues, setClues] = useState<string[]>(['', '', '', '', '']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleClueChange = (index: number, value: string) => {
    const newClues = [...clues];
    newClues[index] = value;
    setClues(newClues);
  };
  
  // All clues must be filled (no validation requirement)
  const allValid = clues.every(c => c.trim() !== '');
  
  const handleSubmit = async () => {
    if (!allValid) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const response = await api.games.submitClues(gameId, {
        clues: clues.map(c => c.trim())
      });
      
      dispatch({
        type: 'CLUES_SUBMITTED',
        gameId: response.game_id,
        divergence: response.divergence_score,
        noiseFloor: noiseFloor,
        seedWord: seedWord
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit clues');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div>
      <ProgressBar currentStep={2} />
      
      <p className="subtitle">
        <span className="subtitle-id">INS-001</span> · Step 2 of 3
      </p>
      <h1 className="title">Provide your clues.</h1>
      
      <p className="description">
        Enter five single-word clues that will help someone guess your target word:{' '}
        <span className="target-word">{seedWord}</span>
      </p>
      
      <Panel title="Semantic Neighborhood" meta="Top 10 predictable associations">
        <NoiseFloor words={noiseFloor} />
        <p className="hint-text">
          These are the most predictable associations. Your divergence score measures how far your clues venture from this neighborhood.
        </p>
      </Panel>
      
      <Panel title="Your Clues" meta="5 required">
        <div className="clue-inputs">
          {clues.map((clue, idx) => (
            <ClueInput
              key={idx}
              number={idx + 1}
              value={clue}
              onChange={(value) => handleClueChange(idx, value)}
              noiseFloor={noiseFloor}
            />
          ))}
        </div>
      </Panel>
      
      {error && (
        <div className="error-message">
          ◈ {error}
        </div>
      )}
      
      <div className="btn-group">
        <Button
          variant="ghost"
          onClick={() => dispatch({ type: 'BACK' })}
        >
          ← Back
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={!allValid || isSubmitting}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Clues →'}
        </Button>
      </div>
    </div>
  );
};
