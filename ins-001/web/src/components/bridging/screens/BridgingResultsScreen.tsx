/**
 * Bridging Results Screen - INS-001.2 V2
 *
 * Shows full results including:
 * - Your Union (user's concepts + binding/divergence metrics)
 * - How Others See This Union (Haiku, Statistical, Human)
 */

import React, { useState } from 'react';
import { useBridgingSenderState } from '../../../lib/bridging-state';
import { Panel } from '../../ui/Panel';
import { Button } from '../../ui/Button';
import { ShareLinkBox } from '../../ui/ShareLinkBox';
import { api } from '../../../lib/api';
import type { BridgingGameResponse } from '../../../lib/api';

interface BridgingResultsScreenProps {
  game: BridgingGameResponse;
}

// 2x2 interpretation based on binding and divergence
function getInterpretation(binding: number, divergence: number): { label: string; description: string } {
  const highBinding = binding >= 50;
  const highDivergence = divergence >= 50;

  if (highBinding && highDivergence) {
    return {
      label: 'Creative union',
      description: 'Your concepts take a novel path while staying connected to both endpoints.',
    };
  } else if (highBinding && !highDivergence) {
    return {
      label: 'Solid union',
      description: 'Your concepts form a direct, well-grounded connection between the endpoints.',
    };
  } else if (!highBinding && highDivergence) {
    return {
      label: 'Drifting',
      description: 'Your concepts arc creatively but connect weakly to one or both endpoints.',
    };
  } else {
    return {
      label: 'Weak union',
      description: 'Your concepts stay close to the obvious path but don\'t connect strongly.',
    };
  }
}

function ScoreBar({
  score,
  leftLabel,
  rightLabel,
  color = 'var(--gold)',
  dimmed = false,
}: {
  score: number;
  leftLabel: string;
  rightLabel: string;
  color?: string;
  dimmed?: boolean;
}) {
  const opacity = dimmed ? 0.4 : 1;
  return (
    <div style={{ opacity }}>
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
  const [shareUrl, setShareUrl] = useState<string | null>(
    game.share_code ? `${window.location.origin}/ins-001-2/join/${game.share_code}` : null
  );
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const divergence = game.divergence_score || 0;
  const binding = game.binding_score || 0;
  const interpretation = getInterpretation(binding, divergence);

  // Dim divergence when binding is below threshold (divergence is meaningless without binding)
  const lowBinding = binding < 40;

  // V2 fields - check for Haiku's bridge (steps)
  const haikuSteps = game.haiku_clues;
  const haikuBinding = game.haiku_binding;
  const haikuBridgeSimilarity = game.haiku_bridge_similarity;
  const hasHaikuBridge = haikuSteps && haikuSteps.length > 0;

  // Lexical union (statistical baseline)
  const lexicalUnion = game.lexical_bridge;
  const lexicalSimilarity = game.lexical_similarity;
  const hasLexicalUnion = lexicalUnion && lexicalUnion.length > 0;

  // Human recipient bridge (V2)
  const recipientSteps = game.recipient_clues;
  const recipientBinding = game.recipient_binding;
  const bridgeSimilarity = game.bridge_similarity;
  const hasHumanBridge = recipientSteps && recipientSteps.length > 0;

  const handleCreateShareLink = async () => {
    setIsCreatingShare(true);
    setShareError(null);
    try {
      const response = await api.bridging.createShare(game.game_id);
      setShareUrl(response.share_url);
    } catch (err) {
      setShareError(err instanceof Error ? err.message : 'Failed to create share link');
    } finally {
      setIsCreatingShare(false);
    }
  };

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

        {/* Score summary line */}
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            color: 'var(--text-light)',
            marginBottom: 'var(--space-xs)',
          }}
        >
          Binding {Math.round(binding)} · Divergence {Math.round(divergence)}
        </div>

        {/* Interpretation */}
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.7rem',
            color: 'var(--gold)',
            marginBottom: 'var(--space-xs)',
          }}
        >
          {interpretation.label}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.65rem',
            color: 'var(--faded)',
            marginBottom: 'var(--space-md)',
          }}
        >
          {interpretation.description}
        </div>

        {/* Binding metric - always prominent */}
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
        </div>

        {/* Divergence metric - dimmed when binding is low */}
        <div style={{ opacity: lowBinding ? 0.4 : 1 }}>
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
              {lowBinding && (
                <span style={{ color: 'var(--faded)', marginLeft: 'var(--space-xs)' }}>
                  (strengthen binding first)
                </span>
              )}
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
              {haikuBridgeSimilarity !== undefined && (
                <span>{Math.round(haikuBridgeSimilarity)}% similar to your thinking</span>
              )}
              {haikuBinding !== undefined && (
                <span> · binding: {Math.round(haikuBinding)}</span>
              )}
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
              Statistical
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
              {bridgeSimilarity !== undefined && (
                <span>{Math.round(bridgeSimilarity)}% similar to your thinking</span>
              )}
              {recipientBinding !== undefined && (
                <span> · binding: {Math.round(recipientBinding)}</span>
              )}
            </div>
          </>
        ) : (
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
                marginBottom: 'var(--space-sm)',
              }}
            >
              Share with a friend to compare unions
            </div>

            {shareUrl ? (
              <ShareLinkBox url={shareUrl} />
            ) : (
              <Button
                variant="secondary"
                onClick={handleCreateShareLink}
                disabled={isCreatingShare}
                style={{
                  fontSize: '0.75rem',
                  padding: 'var(--space-xs) var(--space-sm)',
                }}
              >
                {isCreatingShare ? 'Creating...' : 'Create Share Link'}
              </Button>
            )}

            {shareError && (
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.7rem',
                  color: 'var(--alert)',
                  marginTop: 'var(--space-xs)',
                }}
              >
                {shareError}
              </div>
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
