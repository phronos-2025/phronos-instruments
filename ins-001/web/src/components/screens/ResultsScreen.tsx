/**
 * Results Screen
 * 
 * Score cards, archetype display, profile progress CTA
 */

import React from 'react';
import { useGameState } from '../../lib/state';
import type { GameResponse } from '../../lib/api';
import { Panel } from '../ui/Panel';
import { Button } from '../ui/Button';
import { ProgressBar } from '../ui/ProgressBar';
import { ScoreCard } from '../ui/ScoreCard';
import { ArchetypeDisplay } from '../ui/ArchetypeDisplay';

interface ResultsScreenProps {
  game: GameResponse;
}

export const ResultsScreen: React.FC<ResultsScreenProps> = () => {
  const { state } = useGameState();
  const game = state.screen === 'results' ? state.game : null;
  
  if (!game) return null;
  
  const divergenceInterpretation = 
    game.divergence_score && game.divergence_score < 0.3 ? 'Conventional' :
    game.divergence_score && game.divergence_score < 0.6 ? 'Moderate' :
    'Creative';
  
  const convergenceInterpretation = 
    game.convergence_score && game.convergence_score < 0.4 ? 'Low' :
    game.convergence_score && game.convergence_score < 0.7 ? 'Partial' :
    'High';
  
  return (
    <div>
      <ProgressBar currentStep={4} />
      
      <Panel title="Results">
        <div className="score-grid">
          {game.divergence_score !== undefined && (
            <ScoreCard
              label="Divergence"
              value={game.divergence_score}
              interpretation={divergenceInterpretation}
            />
          )}
          {game.convergence_score !== undefined && (
            <ScoreCard
              label="Convergence"
              value={game.convergence_score}
              interpretation={convergenceInterpretation}
            />
          )}
        </div>
        
        {game.recipient_type === 'llm' && game.guesses && (
          <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--card-bg)', border: '1px solid var(--faded-light)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--faded)', marginBottom: '0.5rem' }}>
              AI GUESSES
            </div>
            <div style={{ color: 'var(--text-light)' }}>
              {game.guesses.join(', ')}
            </div>
          </div>
        )}
        
        <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--card-bg)', border: '1px solid var(--faded-light)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--faded)', marginBottom: '0.5rem' }}>
            SEED WORD
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', color: 'var(--gold)' }}>
            {game.seed_word}
          </div>
        </div>
      </Panel>
      
      {/* Archetype display would go here when profile is ready */}
      
      <div style={{ textAlign: 'center', marginTop: '2rem' }}>
        <Button
          variant="primary"
          onClick={() => window.location.reload()}
        >
          Play Again
        </Button>
      </div>
    </div>
  );
};
