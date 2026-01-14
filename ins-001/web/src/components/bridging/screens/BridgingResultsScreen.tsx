/**
 * Bridging Results Screen - INS-001.2 V2
 *
 * Shows full results including:
 * - Your Union (user's concepts + binding/divergence metrics)
 * - How Others See This Union (Haiku, Statistical, Human)
 */

import React from 'react';
import { useBridgingSenderState } from '../../../lib/bridging-state';
import { Panel } from '../../ui/Panel';
import { Button } from '../../ui/Button';
import type { BridgingGameResponse } from '../../../lib/api';

interface BridgingResultsScreenProps {
  game: BridgingGameResponse;
}

function ScoreBar({
  score,
  leftLabel,
  rightLabel,
  color = 'var(--gold)',
}: {
  score: number;
  leftLabel: string;
  rightLabel: string;
  color?: string;
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
            background: color,
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

function Divider() {
  return (
    <div
      style={{
        borderTop: '1px dashed var(--border)',
        margin: 'var(--space-md) 0',
      }}
    />
  );
}

export const BridgingResultsScreen: React.FC<BridgingResultsScreenProps> = ({
  game,
}) => {
  const { dispatch } = useBridgingSenderState();

  const divergence = game.divergence_score || 0;
  const binding = game.binding_score || 0;

  // V2 fields - check for Haiku's bridge (steps)
  const haikuSteps = game.haiku_clues;
  const haikuBridgeSimilarity = game.haiku_bridge_similarity;
  const hasHaikuBridge = haikuSteps && haikuSteps.length > 0;

  // Lexical union (statistical baseline)
  const lexicalUnion = game.lexical_bridge;
  const lexicalSimilarity = game.lexical_similarity;
  const hasLexicalUnion = lexicalUnion && lexicalUnion.length > 0;

  // Human recipient bridge (V2)
  const recipientSteps = game.recipient_clues;
  const bridgeSimilarity = game.bridge_similarity;
  const hasHumanBridge = recipientSteps && recipientSteps.length > 0;

  return (
    <div>
      <p className="subtitle">
        <span className="id">INS-001.2</span> · Your Results
      </p>
      <h1 className="title">Union Analysis</h1>

      {/* Panel 1: Your Union */}
      <Panel style={{ marginBottom: 'var(--space-md)' }}>
        {/* Anchor-Target display */}
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.9rem',
            color: 'var(--gold)',
            textAlign: 'center',
            marginBottom: 'var(--space-md)',
          }}
        >
          {game.anchor_word} ←―――――――――――――――――――――――――――――――→ {game.target_word}
        </div>

        {/* Your Union */}
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.7rem',
            color: 'var(--text-light)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 'var(--space-xs)',
          }}
        >
          Your Union
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
            color: 'var(--text-light)',
            marginBottom: 'var(--space-md)',
          }}
        >
          {game.clues?.join(' · ')}
        </div>

        {/* Binding metric */}
        <div style={{ marginBottom: 'var(--space-md)' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 'var(--space-xs)',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
                color: 'var(--text-light)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Binding
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                color: 'var(--gold)',
              }}
            >
              {Math.round(binding)}
            </span>
          </div>
          <ScoreBar score={binding} leftLabel="weak" rightLabel="strong" />
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.65rem',
              color: 'var(--faded)',
              marginTop: 'var(--space-xs)',
            }}
          >
            Do your concepts connect to both endpoints?
          </div>
        </div>

        {/* Divergence metric */}
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 'var(--space-xs)',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
                color: 'var(--text-light)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Divergence
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                color: 'var(--gold)',
              }}
            >
              {Math.round(divergence)}
            </span>
          </div>
          <ScoreBar score={divergence} leftLabel="predictable" rightLabel="creative" />
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.65rem',
              color: 'var(--faded)',
              marginTop: 'var(--space-xs)',
            }}
          >
            How far do your concepts arc from the obvious path?
          </div>
        </div>
      </Panel>

      {/* Panel 2: How Others See This Union */}
      <Panel style={{ marginBottom: 'var(--space-md)' }}>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.7rem',
            color: 'var(--faded)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 'var(--space-md)',
          }}
        >
          How Others See This Union
        </div>

        {/* Haiku */}
        {hasHaikuBridge && (
          <>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
                color: 'var(--text-light)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 'var(--space-xs)',
              }}
            >
              Haiku
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                color: 'var(--text-light)',
                marginBottom: 'var(--space-xs)',
              }}
            >
              {haikuSteps.join(' · ')}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                color: 'var(--faded)',
              }}
            >
              {haikuBridgeSimilarity !== undefined
                ? `${Math.round(haikuBridgeSimilarity)}% similar to your thinking`
                : 'Calculating similarity...'}
            </div>
            <Divider />
          </>
        )}

        {/* Statistical (Lexical Union) */}
        {hasLexicalUnion && (
          <>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
                color: 'var(--text-light)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 'var(--space-xs)',
              }}
            >
              Statistical{' '}
              <span style={{ color: 'var(--faded)', textTransform: 'none' }}>
                (embedding midpoint)
              </span>
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                color: 'var(--text-light)',
                marginBottom: 'var(--space-xs)',
              }}
            >
              {lexicalUnion.join(' · ')}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                color: 'var(--faded)',
              }}
            >
              {lexicalSimilarity !== undefined
                ? `${Math.round(lexicalSimilarity)}% similar to your thinking`
                : 'Calculating similarity...'}
            </div>
            <Divider />
          </>
        )}

        {/* Human */}
        {hasHumanBridge ? (
          <>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
                color: 'var(--text-light)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 'var(--space-xs)',
              }}
            >
              Human
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                color: 'var(--text-light)',
                marginBottom: 'var(--space-xs)',
              }}
            >
              {recipientSteps.join(' · ')}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                color: 'var(--faded)',
              }}
            >
              {bridgeSimilarity !== undefined
                ? `${Math.round(bridgeSimilarity)}% similar to your thinking`
                : 'Calculating similarity...'}
            </div>
          </>
        ) : (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.7rem',
                  color: 'var(--text-light)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: 'var(--space-xs)',
                }}
              >
                Human
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  color: 'var(--faded)',
                }}
              >
                Share with a friend to compare
              </div>
            </div>
            {game.share_code && (
              <Button
                variant="secondary"
                onClick={() => {
                  const shareUrl = `${window.location.origin}/bridging/join/${game.share_code}`;
                  navigator.clipboard.writeText(shareUrl);
                }}
                style={{
                  fontSize: '0.75rem',
                  padding: 'var(--space-xs) var(--space-sm)',
                }}
              >
                Share
              </Button>
            )}
          </div>
        )}
      </Panel>

      <div className="btn-group">
        <Button variant="primary" onClick={() => dispatch({ type: 'RESET' })}>
          Build Another Union
        </Button>
      </div>
    </div>
  );
};
