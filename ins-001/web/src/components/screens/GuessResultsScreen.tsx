/**
 * Guess Results Screen
 * 
 * See if they got it right + convergence score + sender's seed word
 */

import React from 'react';
import type { SubmitGuessesResponse } from '../../lib/api';
import { Panel } from '../ui/Panel';
import { Button } from '../ui/Button';
import { ScoreCard } from '../ui/ScoreCard';

interface GuessResultsScreenProps {
  game: SubmitGuessesResponse;
  guesses: string[];
}

export const GuessResultsScreen: React.FC<GuessResultsScreenProps> = ({ game, guesses }) => {
  const convergenceInterpretation = 
    game.convergence_score < 0.4 ? 'Low convergence' :
    game.convergence_score < 0.7 ? 'Partial convergence' :
    'High convergence';
  
  return (
    <div>
      <Panel title="Results">
        {game.exact_match ? (
          <div style={{ 
            padding: '1.5rem', 
            background: 'var(--active)', 
            color: 'var(--bg-deep)',
            textAlign: 'center',
            marginBottom: '1.5rem',
            fontFamily: 'var(--font-serif)',
            fontSize: '1.2rem'
          }}>
            ✓ Correct! You guessed it!
          </div>
        ) : (
          <div style={{ 
            padding: '1.5rem', 
            background: 'var(--card-bg)', 
            border: '1px solid var(--faded-light)',
            textAlign: 'center',
            marginBottom: '1.5rem'
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--faded)', marginBottom: '0.5rem' }}>
              YOUR GUESSES
            </div>
            <div style={{ color: 'var(--text-light)' }}>
              {guesses.join(', ')}
            </div>
          </div>
        )}
        
        <ScoreCard
          label="Convergence"
          value={game.convergence_score}
          interpretation={convergenceInterpretation}
        />
        
        <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--card-bg)', border: '1px solid var(--faded-light)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--faded)', marginBottom: '0.5rem' }}>
            THE WORD WAS
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', color: 'var(--gold)' }}>
            {game.seed_word}
          </div>
        </div>
        
        <p style={{ marginTop: '1.5rem', color: 'var(--faded)', fontSize: 'var(--text-sm)' }}>
          Convergence measures how well the sender's clues communicated their intended word.
          Higher scores indicate successful semantic transmission.
        </p>
      </Panel>
      
      <div style={{ textAlign: 'center', marginTop: '2rem' }}>
        <Button
          variant="primary"
          onClick={() => window.location.href = '/'}
        >
          Play Your Own Game
        </Button>
      </div>
    </div>
  );
};
