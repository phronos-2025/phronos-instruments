/**
 * Clues Screen
 * 
 * Noise floor visualization, 5 clue inputs with validation
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
  const [validClues, setValidClues] = useState<boolean[]>([false, false, false, false, false]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleClueChange = (index: number, value: string) => {
    const newClues = [...clues];
    newClues[index] = value;
    setClues(newClues);
  };
  
  const handleValidationChange = (index: number, isValid: boolean) => {
    const newValid = [...validClues];
    newValid[index] = isValid;
    setValidClues(newValid);
  };
  
  const allValid = validClues.every(v => v) && clues.every(c => c.trim());
  
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
        divergence: response.divergence_score
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
      
      <Panel title="Step 2: Write Your Clues">
        <p style={{ marginBottom: '1rem', color: 'var(--faded)' }}>
          Write 5 clues that hint at <strong style={{ color: 'var(--gold)' }}>"{seedWord}"</strong>.
          Each clue must be a valid English word from the vocabulary.
        </p>
        
        <NoiseFloor words={noiseFloor} />
        
        <div className="clue-inputs" style={{ marginTop: '1.5rem' }}>
          {clues.map((clue, idx) => (
            <ClueInput
              key={idx}
              number={idx + 1}
              value={clue}
              onChange={(value) => handleClueChange(idx, value)}
              onValidationChange={(isValid) => handleValidationChange(idx, isValid)}
            />
          ))}
        </div>
        
        {error && (
          <div style={{ color: 'var(--alert)', marginTop: '1rem', fontSize: 'var(--text-sm)' }}>
            ◈ {error}
          </div>
        )}
        
        <div className="btn-group">
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!allValid || isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Clues'}
          </Button>
        </div>
      </Panel>
    </div>
  );
};
