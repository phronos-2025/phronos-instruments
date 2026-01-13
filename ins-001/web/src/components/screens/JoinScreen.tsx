/**
 * Join Screen
 * 
 * See clues, sender name, enter 3 guesses
 */

import React, { useState } from 'react';
import { api } from '../../lib/api';
import { Panel } from '../ui/Panel';
import { Button } from '../ui/Button';
import { ClueInput } from '../ui/ClueInput';

interface JoinScreenProps {
  game: api.JoinGameResponse;
  onGuessesSubmitted: (response: api.SubmitGuessesResponse, guesses: string[]) => void;
}

export const JoinScreen: React.FC<JoinScreenProps> = ({ game, onGuessesSubmitted }) => {
  const [guesses, setGuesses] = useState<string[]>(['', '', '']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleGuessChange = (index: number, value: string) => {
    const newGuesses = [...guesses];
    newGuesses[index] = value;
    setGuesses(newGuesses);
  };
  
  // All guesses must be filled (no validation requirement)
  const allValid = guesses.every(g => g.trim() !== '');
  
  const handleSubmit = async () => {
    if (!allValid) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const response = await api.games.submitGuesses(game.game_id, {
        guesses: guesses.map(g => g.trim())
      });
      
      onGuessesSubmitted(response, guesses.map(g => g.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit guesses');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div>
      <Panel title="Guess the Word">
        {game.sender_display_name && (
          <p style={{ marginBottom: '1rem', color: 'var(--faded)' }}>
            {game.sender_display_name} wrote these clues:
          </p>
        )}
        
        <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--card-bg)', border: '1px solid var(--faded-light)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--faded)', marginBottom: '0.5rem' }}>
            CLUES
          </div>
          <div style={{ color: 'var(--text-light)', lineHeight: '1.8' }}>
            {game.clues.map((clue, idx) => (
              <div key={idx} style={{ marginBottom: '0.5rem' }}>
                {idx + 1}. {clue}
              </div>
            ))}
          </div>
        </div>
        
        <p style={{ marginBottom: '1rem', color: 'var(--faded)' }}>
          Enter 3 guesses. Any word is accepted.
        </p>
        
        <div className="clue-inputs">
          {guesses.map((guess, idx) => (
            <ClueInput
              key={idx}
              number={idx + 1}
              value={guess}
              onChange={(value) => handleGuessChange(idx, value)}
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
            {isSubmitting ? 'Submitting...' : 'Submit Guesses'}
          </Button>
        </div>
      </Panel>
    </div>
  );
};
