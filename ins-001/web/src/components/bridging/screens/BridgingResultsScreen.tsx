/**
 * Bridging Results Screen - INS-001.2
 *
 * Shows full results including divergence, reconstruction scores, and baselines.
 */

import React from 'react';
import { useBridgingSenderState } from '../../../lib/bridging-state';
import { Panel } from '../../ui/Panel';
import { Button } from '../../ui/Button';
import type { BridgingGameResponse } from '../../../lib/api';

interface BridgingResultsScreenProps {
  game: BridgingGameResponse;
}

function getScoreLabel(score: number, type: 'divergence' | 'reconstruction'): string {
  if (type === 'divergence') {
    if (score < 30) return 'Predictable';
    if (score < 50) return 'Moderate';
    if (score < 70) return 'Creative';
    return 'Highly Creative';
  } else {
    if (score < 40) return 'Opaque';
    if (score < 60) return 'Partial';
    if (score < 80) return 'Good';
    return 'Transparent';
  }
}

function ScoreBar({
  score,
  leftLabel,
  rightLabel,
}: {
  score: number;
  leftLabel: string;
  rightLabel: string;
}) {
  return (
    <div>
      <div
        style={{
          background: 'var(--bg-card)',
          borderRadius: '4px',
          height: '8px',
          overflow: 'hidden',
          marginBottom: 'var(--space-xs)',
        }}
      >
        <div
          style={{
            background: 'var(--gold)',
            height: '100%',
            width: `${Math.min(100, score)}%`,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.65rem',
          color: 'var(--faded)',
        }}
      >
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}

export const BridgingResultsScreen: React.FC<BridgingResultsScreenProps> = ({
  game,
}) => {
  const { dispatch } = useBridgingSenderState();

  const divergence = game.divergence_score || 0;
  const humanRecon = game.reconstruction_score;
  const haikuRecon = game.haiku_reconstruction_score;
  const statisticalRecon = game.statistical_baseline_score;

  // Determine which reconstruction to show as primary
  const primaryRecon = humanRecon ?? haikuRecon ?? 0;
  const hasHumanRecon = humanRecon !== undefined && humanRecon !== null;

  return (
    <div>
      <p className="subtitle">
        <span className="id">INS-001.2</span> · Your Results
      </p>
      <h1 className="title">Bridge Analysis</h1>

      {/* Bridge display */}
      <div
        style={{
          textAlign: 'center',
          marginBottom: 'var(--space-lg)',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.9rem',
            color: 'var(--gold)',
            marginBottom: 'var(--space-sm)',
          }}
        >
          {game.anchor_word} ←――――――――――――――――→ {game.target_word}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
            color: 'var(--text-light)',
          }}
        >
          {game.clues?.join(' · ')}
        </div>
      </div>

      {/* Divergence Score */}
      <Panel
        title="Divergence"
        meta={Math.round(divergence).toString()}
        style={{ marginBottom: 'var(--space-md)' }}
      >
        <ScoreBar
          score={divergence}
          leftLabel="predictable"
          rightLabel="creative"
        />
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            color: 'var(--faded)',
            marginTop: 'var(--space-sm)',
          }}
        >
          How far your clues arc from the direct path.
        </div>
      </Panel>

      {/* Reconstruction Score (Human or Haiku) */}
      <Panel
        title={hasHumanRecon ? 'Reconstruction (Human)' : 'Reconstruction (Haiku)'}
        meta={Math.round(primaryRecon).toString()}
        style={{ marginBottom: 'var(--space-md)' }}
      >
        <ScoreBar
          score={primaryRecon}
          leftLabel="opaque"
          rightLabel="transparent"
        />
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            color: 'var(--faded)',
            marginTop: 'var(--space-sm)',
          }}
        >
          How accurately {hasHumanRecon ? 'your recipient' : 'Haiku'} recovered your anchor-target pair.
        </div>

        {/* Show guesses */}
        {(hasHumanRecon ? game.guessed_anchor : game.haiku_guessed_anchor) && (
          <div
            style={{
              marginTop: 'var(--space-md)',
              padding: 'var(--space-sm)',
              background: 'var(--bg-card)',
              borderRadius: '4px',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
                color: 'var(--faded)',
                marginBottom: 'var(--space-xs)',
              }}
            >
              {hasHumanRecon ? 'Their guess:' : "Haiku's guess:"}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                color: 'var(--text-light)',
              }}
            >
              {hasHumanRecon
                ? `${game.guessed_anchor} ←→ ${game.guessed_target}`
                : `${game.haiku_guessed_anchor} ←→ ${game.haiku_guessed_target}`}
            </div>
            {(hasHumanRecon ? game.exact_anchor_match : false) &&
              (hasHumanRecon ? game.exact_target_match : false) && (
                <div
                  style={{
                    color: 'var(--gold)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    marginTop: 'var(--space-xs)',
                  }}
                >
                  ✓ Exact match!
                </div>
              )}
          </div>
        )}
      </Panel>

      {/* Baselines (if available) */}
      {(haikuRecon !== undefined || statisticalRecon !== undefined) && hasHumanRecon && (
        <Panel title="Baselines" style={{ marginBottom: 'var(--space-lg)' }}>
          {haikuRecon !== undefined && (
            <div style={{ marginBottom: 'var(--space-md)' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem',
                  marginBottom: 'var(--space-xs)',
                }}
              >
                <span style={{ color: 'var(--text-light)' }}>Haiku (LLM):</span>
                <span style={{ color: 'var(--gold)' }}>{Math.round(haikuRecon)}</span>
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.65rem',
                  color: 'var(--faded)',
                }}
              >
                What a reasoning AI inferred from your clues.
                {game.haiku_guessed_anchor && (
                  <span>
                    {' '}
                    ({game.haiku_guessed_anchor} ←→ {game.haiku_guessed_target})
                  </span>
                )}
              </div>
            </div>
          )}

          {statisticalRecon !== undefined && (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.8rem',
                  marginBottom: 'var(--space-xs)',
                }}
              >
                <span style={{ color: 'var(--text-light)' }}>Statistical:</span>
                <span style={{ color: 'var(--gold)' }}>
                  {Math.round(statisticalRecon)}
                </span>
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.65rem',
                  color: 'var(--faded)',
                }}
              >
                What embedding geometry predicts.
              </div>
            </div>
          )}

          {/* Comparison message */}
          {hasHumanRecon && haikuRecon !== undefined && (
            <div
              style={{
                marginTop: 'var(--space-md)',
                padding: 'var(--space-sm)',
                background: 'var(--bg-card)',
                borderRadius: '4px',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                color: 'var(--text-light)',
              }}
            >
              {humanRecon! > haikuRecon
                ? 'Your human recipient outperformed the AI baseline.'
                : humanRecon! < haikuRecon
                ? 'The AI baseline outperformed your human recipient.'
                : 'Your human recipient matched the AI baseline.'}
            </div>
          )}
        </Panel>
      )}

      <div className="btn-group">
        <Button variant="primary" onClick={() => dispatch({ type: 'RESET' })}>
          Build Another Bridge
        </Button>
      </div>
    </div>
  );
};
