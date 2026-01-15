/**
 * Results Screen
 *
 * Barbell visualization for divergence/convergence metrics,
 * "Unregistered Record" panel with progress, footer links
 */

import React, { useState } from 'react';
import { useGameState } from '../../lib/state';
import type { GameResponse } from '../../lib/api';
import { Panel } from '../ui/Panel';
import { Button } from '../ui/Button';
import { MagicLinkModal } from '../auth/MagicLinkModal';

interface ResultsScreenProps {
  game: GameResponse;
}

// Barbell row component (adapted from BridgingResultsScreen)
interface BarbellRowProps {
  label: string;
  concepts: string[];
  divergence: number;
  convergence: number;
  isYou?: boolean;
}

function BarbellRow({ label, concepts, divergence, convergence, isYou }: BarbellRowProps) {
  const scale = (val: number) => Math.min(100, Math.max(0, val));

  return (
    <div style={{ marginBottom: 'var(--space-lg)' }}>
      {/* Concepts above the track */}
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
          color: isYou ? 'var(--gold)' : 'var(--text-light)',
          marginBottom: 'var(--space-xs)',
          letterSpacing: '0.02em',
          textAlign: 'center',
          marginLeft: '92px',
        }}
      >
        {concepts.join(' · ')}
      </div>

      {/* Row with label, track, and values */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
        {/* Label */}
        <div
          style={{
            width: '80px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.65rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: isYou ? 'var(--gold)' : 'var(--text-light)',
          }}
        >
          {label}
        </div>

        {/* Track */}
        <div
          style={{
            flex: 1,
            height: '32px',
            position: 'relative',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '2px',
            marginBottom: '16px',
          }}
        >
          {/* Gridlines */}
          {[25, 50, 75].map((v) => (
            <div
              key={v}
              style={{
                position: 'absolute',
                left: `${v}%`,
                top: 0,
                bottom: 0,
                width: '1px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
              }}
            />
          ))}

          {/* Connecting line */}
          <div
            style={{
              position: 'absolute',
              left: `${Math.min(scale(divergence), scale(convergence))}%`,
              width: `${Math.abs(scale(convergence) - scale(divergence))}%`,
              top: '50%',
              height: '2px',
              backgroundColor: 'var(--gold)',
              opacity: 0.4,
              transform: 'translateY(-50%)',
            }}
          />

          {/* Divergence dot (filled) */}
          <div
            style={{
              position: 'absolute',
              left: `${scale(divergence)}%`,
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: 'var(--gold)',
            }}
          />

          {/* Convergence dot (hollow) */}
          <div
            style={{
              position: 'absolute',
              left: `${scale(convergence)}%`,
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              border: '2px solid var(--gold)',
              backgroundColor: 'var(--bg)',
              boxSizing: 'border-box',
            }}
          />

          {/* Value labels */}
          <span
            style={{
              position: 'absolute',
              left: `${scale(divergence)}%`,
              bottom: '-16px',
              transform: 'translateX(-50%)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6rem',
              color: 'var(--gold)',
            }}
          >
            {Math.round(divergence)}
          </span>
          <span
            style={{
              position: 'absolute',
              left: `${scale(convergence)}%`,
              bottom: '-16px',
              transform: 'translateX(-50%)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6rem',
              color: 'var(--faded)',
            }}
          >
            {Math.round(convergence)}
          </span>
        </div>
      </div>
    </div>
  );
}

export const ResultsScreen: React.FC<ResultsScreenProps> = () => {
  const { state, dispatch } = useGameState();
  const game = state.screen === 'results' ? state.game : null;
  const [showInitModal, setShowInitModal] = useState(false);

  if (!game) return null;

  // Convert scores to 0-100 scale for display
  const divergenceDisplay = (game.divergence_score ?? 0) * 100;
  const convergenceDisplay = (game.convergence_score ?? 0) * 100;

  const divergenceInterpretation =
    game.divergence_score && game.divergence_score < 0.3
      ? 'Conventional'
      : game.divergence_score && game.divergence_score < 0.6
      ? 'Moderate'
      : 'High';

  const convergenceInterpretation =
    game.convergence_score && game.convergence_score < 0.4
      ? 'Low'
      : game.convergence_score && game.convergence_score < 0.7
      ? 'Partial'
      : 'Strong';

  // Format guesses for display as pills with shaded bars
  const formatGuess = (guess: string, index: number) => {
    const similarity = game.guess_similarities?.[index];
    const isExact = guess.toLowerCase() === game.seed_word.toLowerCase();
    const similarityPercent =
      similarity !== undefined ? Math.min(Math.max(similarity * 100, 0), 100) : 0;
    const borderColor = isExact ? 'var(--active)' : 'rgba(242, 240, 233, 0.15)';
    const textColor = isExact ? 'var(--active)' : 'var(--faded)';

    return (
      <span
        key={index}
        className="noise-word"
        data-similarity={similarity !== undefined ? similarity.toFixed(2) : '—'}
        style={
          {
            '--similarity-width': `${similarityPercent}%`,
            borderColor: borderColor,
            color: textColor,
          } as React.CSSProperties
        }
        title={
          similarity !== undefined ? `Similarity: ${similarity.toFixed(2)}` : 'Similarity: —'
        }
      >
        {guess}
      </span>
    );
  };

  return (
    <div>
      <p className="subtitle">
        <span className="id">INS-001.1</span> · Complete
      </p>
      <h1 className="title">Results.</h1>

      <p className="description">Your semantic association profile for this session.</p>

      <Panel>
        {/* Target word display */}
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
            color: 'var(--gold)',
            textAlign: 'center',
            marginBottom: 'var(--space-lg)',
          }}
        >
          Target: {game.seed_word}
        </div>

        {/* Legend */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 'var(--space-md)',
            marginBottom: 'var(--space-md)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.6rem',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: 'var(--faded)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 'var(--gold)',
              }}
            />
            <span>Divergence</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                border: '2px solid var(--gold)',
                backgroundColor: 'transparent',
                boxSizing: 'border-box',
              }}
            />
            <span>Convergence</span>
          </div>
        </div>

        {/* Axis scale */}
        <div style={{ marginLeft: '92px', marginRight: '12px', marginBottom: 'var(--space-sm)' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--faded)',
              marginBottom: '2px',
            }}
          >
            {[0, 25, 50, 75, 100].map((v) => (
              <span key={v}>{v}</span>
            ))}
          </div>
          <div
            style={{
              height: '1px',
              backgroundColor: 'var(--border)',
              position: 'relative',
            }}
          >
            {[0, 25, 50, 75, 100].map((v) => (
              <div
                key={v}
                style={{
                  position: 'absolute',
                  left: `${v}%`,
                  top: '-2px',
                  width: '1px',
                  height: '5px',
                  backgroundColor: 'var(--border)',
                }}
              />
            ))}
          </div>
        </div>

        {/* Barbell visualization */}
        <div style={{ marginTop: 'var(--space-md)' }}>
          <BarbellRow
            label="You"
            concepts={game.clues || []}
            divergence={divergenceDisplay}
            convergence={convergenceDisplay}
            isYou
          />
        </div>
      </Panel>

      {game.recipient_type === 'llm' && game.guesses && game.guesses.length > 0 && (
        <Panel title="Claude's Guesses" meta={`${game.guesses.length} attempts`}>
          <div className="noise-words">
            {game.guesses.map((guess, idx) => formatGuess(guess, idx))}
          </div>
        </Panel>
      )}

      <Panel
        className=""
        style={{ background: 'transparent', borderColor: 'var(--faded-light)' }}
      >
        <div className="panel-header">
          <span className="panel-title">Interpretation</span>
        </div>
        <div
          className="panel-content"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.9rem',
            color: 'var(--faded)',
            lineHeight: '1.7',
          }}
        >
          Your associations show {divergenceInterpretation.toLowerCase()} divergence (
          {game.divergence_score?.toFixed(2) || 'N/A'}) from the predictable semantic
          neighborhood,
          {game.convergence_score !== undefined &&
            ` indicating ${convergenceInterpretation.toLowerCase()} communication effectiveness.`}
          {game.convergence_score === undefined && ' indicating unexpected pathways.'}
        </div>
      </Panel>

      <Panel
        className=""
        style={{
          borderColor: 'var(--gold)',
          background: 'linear-gradient(to bottom, var(--card-bg), rgba(176, 141, 85, 0.05))',
        }}
      >
        <div className="panel-header" style={{ borderBottomColor: 'var(--gold-dim)' }}>
          <span className="panel-title" style={{ color: 'var(--gold)' }}>
            Unregistered Record
          </span>
          <span className="panel-meta">
            Session ID: #{game.game_id?.slice(0, 4).toUpperCase() || '----'}
          </span>
        </div>
        <div className="panel-content">
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-md)',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: 1, minWidth: '200px' }}>
              <p
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  color: 'var(--text-light)',
                  marginBottom: 'var(--space-xs)',
                }}
              >
                Save your scores to your permanent cognitive profile.
              </p>
            </div>

            <Button
              variant="primary"
              style={{ fontSize: '0.65rem', padding: '10px 20px' }}
              onClick={() => setShowInitModal(true)}
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
          <a href="/methods" style={{ color: 'var(--faded)', textDecoration: 'none' }}>
            Methodology
          </a>{' '}
          ·{' '}
          <a href="/about" style={{ color: 'var(--faded)', textDecoration: 'none' }}>
            About Phronos
          </a>{' '}
          ·{' '}
          <a href="/constitution" style={{ color: 'var(--faded)', textDecoration: 'none' }}>
            Constitution
          </a>
        </div>
        <div>© 2026 Phronos Observatory</div>
      </footer>

      <MagicLinkModal isOpen={showInitModal} onClose={() => setShowInitModal(false)} />
    </div>
  );
};
