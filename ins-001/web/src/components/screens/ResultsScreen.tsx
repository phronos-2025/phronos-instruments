/**
 * Results Screen
 * 
 * Matches mockup: score grid, archetype display, interpretation panel, 
 * "Unregistered Record" panel with progress, footer links
 */

import React from 'react';
import { useGameState } from '../../lib/state';
import type { GameResponse } from '../../lib/api';
import { Panel } from '../ui/Panel';
import { Button } from '../ui/Button';
import { ScoreCard } from '../ui/ScoreCard';
import { ArchetypeDisplay } from '../ui/ArchetypeDisplay';

interface ResultsScreenProps {
  game: GameResponse;
}

export const ResultsScreen: React.FC<ResultsScreenProps> = () => {
  const { state, dispatch } = useGameState();
  const game = state.screen === 'results' ? state.game : null;
  
  if (!game) return null;
  
  const divergenceInterpretation = 
    game.divergence_score && game.divergence_score < 0.3 ? 'Conventional' :
    game.divergence_score && game.divergence_score < 0.6 ? 'Moderate' :
    'High';
  
  const convergenceInterpretation = 
    game.convergence_score && game.convergence_score < 0.4 ? 'Low' :
    game.convergence_score && game.convergence_score < 0.7 ? 'Partial' :
    'Strong';
  
  // Format guesses for display as pills with shaded bars
  const formatGuess = (guess: string, index: number) => {
    const similarity = game.guess_similarities?.[index];
    const isExact = guess.toLowerCase() === game.seed_word.toLowerCase();
    const similarityPercent = similarity !== undefined ? Math.min(Math.max(similarity * 100, 0), 100) : 0;
    const borderColor = isExact ? 'var(--active)' : 'rgba(242, 240, 233, 0.15)';
    const textColor = isExact ? 'var(--active)' : 'var(--faded)';
    
    return (
      <span
        key={index}
        className="noise-word"
        data-similarity={similarity !== undefined ? similarity.toFixed(2) : '—'}
        style={{ 
          '--similarity-width': `${similarityPercent}%`,
          borderColor: borderColor,
          color: textColor
        } as React.CSSProperties}
        title={similarity !== undefined ? `Similarity: ${similarity.toFixed(2)}` : 'Similarity: —'}
      >
        {guess}
      </span>
    );
  };
  
  // Mock archetype - would come from profile in real implementation
  const archetype = 'Creative Communicator';
  
  // Mock progress - would come from profile in real implementation
  const progressGames = 3;
  const progressTotal = 15;
  const progressPercent = Math.round((progressGames / progressTotal) * 100);
  
  return (
    <div>
      <p className="subtitle">
        <span className="id">INS-001</span> · Complete
      </p>
      <h1 className="title">Results.</h1>
      
      <p className="description">
        Your semantic association profile for this session.
      </p>
      
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
        
      {game.recipient_type === 'llm' && game.guesses && game.guesses.length > 0 && (
        <Panel title="Claude's Guesses" meta={`${game.guesses.length} attempts`}>
          <div className="noise-words">
            {game.guesses.map((guess, idx) => formatGuess(guess, idx))}
          </div>
        </Panel>
        )}
        
      <ArchetypeDisplay archetype={archetype} />
      
      <Panel className="" style={{ background: 'transparent', borderColor: 'var(--faded-light)' }}>
        <div className="panel-header">
          <span className="panel-title">Interpretation</span>
        </div>
        <div className="panel-content" style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem', color: 'var(--faded)', lineHeight: '1.7' }}>
          Your associations show {divergenceInterpretation.toLowerCase()} divergence ({game.divergence_score?.toFixed(2) || 'N/A'}) from the predictable semantic neighborhood, 
          {game.convergence_score !== undefined && ` indicating ${convergenceInterpretation.toLowerCase()} communication effectiveness.`}
          {game.convergence_score === undefined && ' indicating creative, unexpected pathways.'}
        </div>
      </Panel>
      
      <Panel className="" style={{ borderColor: 'var(--gold)', background: 'linear-gradient(to bottom, var(--card-bg), rgba(176, 141, 85, 0.05))' }}>
        <div className="panel-header" style={{ borderBottomColor: 'var(--gold-dim)' }}>
          <span className="panel-title" style={{ color: 'var(--gold)' }}>Unregistered Record</span>
          <span className="panel-meta">Session ID: #{game.game_id?.slice(0, 4).toUpperCase() || 'A7F3'}</span>
        </div>
        <div className="panel-content">
          <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-light)', marginBottom: 'var(--space-xs)' }}>
                Save this Divergence Score ({game.divergence_score?.toFixed(2) || 'N/A'}) to your permanent cognitive profile.
              </p>
              <div className="score-bar" style={{ height: '4px', margin: 'var(--space-sm) 0', opacity: 0.5 }}>
                <div className="score-bar-fill" style={{ width: `${progressPercent}%` }} />
              </div>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--faded)' }}>
                Progress: {progressGames}/{progressTotal} instruments complete
              </p>
          </div>
            
            <Button
              variant="primary"
              style={{ fontSize: '0.65rem', padding: '10px 20px' }}
              onClick={() => {
                // TODO: Trigger account creation modal
                console.log('Initialize ID clicked');
              }}
            >
              Initialize ID
            </Button>
          </div>
        </div>
      </Panel>
      
      <div className="btn-group">
        <Button
          variant="secondary"
          onClick={() => {
            dispatch({ type: 'RESET' });
            window.location.reload();
          }}
        >
          Play Again
        </Button>
      </div>
      
      <footer className="footer">
        <div>
          <a href="/methods" style={{ color: 'var(--faded)', textDecoration: 'none' }}>Methodology</a>{' '}·{' '}
          <a href="/about" style={{ color: 'var(--faded)', textDecoration: 'none' }}>About Phronos</a>{' '}·{' '}
          <a href="/constitution" style={{ color: 'var(--faded)', textDecoration: 'none' }}>Constitution</a>
        </div>
        <div>
          © 2026 Phronos Observatory
        </div>
      </footer>
    </div>
  );
};
