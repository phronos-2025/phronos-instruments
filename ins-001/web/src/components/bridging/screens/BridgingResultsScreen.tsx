/**
 * Bridging Results Screen - INS-001.2 V2
 *
 * Shows full results including:
 * - Your Semantic Bridge (user's steps + divergence)
 * - The Lexical Bridge (embedding-based shortest path)
 * - The LLM Bridge (Haiku's steps)
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

export const BridgingResultsScreen: React.FC<BridgingResultsScreenProps> = ({
  game,
}) => {
  const { dispatch } = useBridgingSenderState();

  const divergence = game.divergence_score || 0;
  const stepCount = game.clues?.length || 0;

  // V2 fields - check for Haiku's bridge (steps)
  const haikuSteps = game.haiku_clues;
  const haikuDivergence = game.haiku_divergence;
  const haikuBridgeSimilarity = game.haiku_bridge_similarity;
  const hasHaikuBridge = haikuSteps && haikuSteps.length > 0;

  // V1 legacy fields - Haiku's guesses (deprecated)
  const haikuGuessedAnchor = game.haiku_guessed_anchor;
  const haikuGuessedTarget = game.haiku_guessed_target;
  const haikuReconstructionScore = game.haiku_reconstruction_score;
  const hasLegacyHaikuGuess = haikuGuessedAnchor && haikuGuessedTarget && !hasHaikuBridge;

  // Human recipient bridge (V2)
  const recipientSteps = game.recipient_clues;
  const recipientDivergence = game.recipient_divergence;
  const bridgeSimilarity = game.bridge_similarity;
  const hasHumanBridge = recipientSteps && recipientSteps.length > 0;

  // Human recipient guesses (V1 legacy)
  const hasLegacyHumanGuess = game.guessed_anchor && game.guessed_target;

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

      {/* Your Semantic Bridge */}
      <Panel
        title="Your Semantic Bridge"
        meta={Math.round(divergence).toString()}
        style={{ marginBottom: 'var(--space-md)' }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
            color: 'var(--text-light)',
            lineHeight: '1.8',
            marginBottom: 'var(--space-md)',
          }}
        >
          {game.clues?.map((clue, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
              <span style={{ color: 'var(--gold)', fontSize: '0.7rem' }}>•</span>
              <span>{clue}</span>
            </div>
          ))}
        </div>
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
          How far your steps arc from the direct path.
        </div>
      </Panel>

      {/* The Lexical Bridge - embedding-based path */}
      <Panel
        title="The Lexical Bridge"
        meta="0 steps"
        style={{ marginBottom: 'var(--space-md)' }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            color: 'var(--faded)',
            marginBottom: 'var(--space-sm)',
          }}
        >
          The shortest semantic path between anchor and target:
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
            color: 'var(--faded)',
            textAlign: 'center',
            padding: 'var(--space-sm)',
            marginBottom: 'var(--space-xs)',
          }}
        >
          (direct connection)
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.65rem',
            color: 'var(--faded)',
            textAlign: 'center',
          }}
        >
          Direct embedding distance (baseline)
        </div>
      </Panel>

      {/* The LLM Bridge (Haiku) */}
      {hasHaikuBridge && (
        <Panel
          title="The LLM Bridge (Haiku)"
          meta={haikuDivergence !== undefined ? Math.round(haikuDivergence).toString() : undefined}
          style={{ marginBottom: 'var(--space-md)' }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
              color: 'var(--text-light)',
              lineHeight: '1.8',
              marginBottom: 'var(--space-md)',
            }}
          >
            {haikuSteps.map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                <span style={{ color: 'var(--text-light)', fontSize: '0.7rem' }}>•</span>
                <span>{step}</span>
              </div>
            ))}
          </div>

          {haikuDivergence !== undefined && (
            <>
              <ScoreBar
                score={haikuDivergence}
                leftLabel="predictable"
                rightLabel="creative"
                color="var(--text-light)"
              />
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  color: 'var(--faded)',
                  marginTop: 'var(--space-sm)',
                }}
              >
                How far Haiku's steps arc from the direct path.
              </div>
            </>
          )}
        </Panel>
      )}

      {/* Legacy Haiku Guess (V1) - for old games */}
      {hasLegacyHaikuGuess && (
        <Panel
          title="The LLM Bridge (Haiku)"
          meta={haikuReconstructionScore !== undefined ? Math.round(haikuReconstructionScore).toString() : undefined}
          style={{ marginBottom: 'var(--space-md)' }}
        >
          <div
            style={{
              marginBottom: 'var(--space-sm)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              color: 'var(--text-light)',
            }}
          >
            {haikuGuessedAnchor} ←→ {haikuGuessedTarget}
          </div>
          {haikuReconstructionScore !== undefined && (
            <ScoreBar
              score={haikuReconstructionScore}
              leftLabel="opaque"
              rightLabel="transparent"
              color="var(--text-light)"
            />
          )}
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              color: 'var(--faded)',
              marginTop: 'var(--space-sm)',
            }}
          >
            Legacy: What Haiku guessed from your steps.
          </div>
        </Panel>
      )}

      {/* Human Recipient Bridge (V2) */}
      {hasHumanBridge && (
        <Panel
          title="Recipient's Bridge"
          meta={bridgeSimilarity !== undefined ? `${Math.round(bridgeSimilarity)}% similar` : undefined}
          style={{ marginBottom: 'var(--space-md)' }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
              color: 'var(--text-light)',
              lineHeight: '1.8',
              marginBottom: 'var(--space-md)',
            }}
          >
            {recipientSteps.map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                <span style={{ color: 'var(--gold)', fontSize: '0.7rem' }}>•</span>
                <span>{step}</span>
              </div>
            ))}
          </div>

          {bridgeSimilarity !== undefined && (
            <>
              <ScoreBar
                score={bridgeSimilarity}
                leftLabel="divergent"
                rightLabel="identical"
              />
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  color: 'var(--faded)',
                  marginTop: 'var(--space-sm)',
                }}
              >
                {bridgeSimilarity >= 70
                  ? 'You and your recipient think alike!'
                  : bridgeSimilarity >= 40
                  ? 'You took different but related paths.'
                  : 'You had very different mental routes.'}
              </div>
            </>
          )}

          {recipientDivergence !== undefined && (
            <div
              style={{
                marginTop: 'var(--space-sm)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.65rem',
                color: 'var(--faded)',
              }}
            >
              Their divergence: {Math.round(recipientDivergence)}%
            </div>
          )}
        </Panel>
      )}

      {/* Legacy Human Guess (V1) */}
      {hasLegacyHumanGuess && !hasHumanBridge && (
        <Panel
          title="Recipient's Reconstruction"
          meta={game.reconstruction_score !== undefined ? Math.round(game.reconstruction_score).toString() : undefined}
          style={{ marginBottom: 'var(--space-md)' }}
        >
          <div
            style={{
              marginBottom: 'var(--space-sm)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              color: 'var(--text-light)',
            }}
          >
            {game.guessed_anchor} ←→ {game.guessed_target}
            {game.order_swapped && (
              <span
                style={{
                  fontSize: '0.7rem',
                  color: 'var(--faded)',
                  marginLeft: 'var(--space-sm)',
                }}
              >
                (order swapped)
              </span>
            )}
          </div>
          {game.reconstruction_score !== undefined && (
            <ScoreBar
              score={game.reconstruction_score}
              leftLabel="opaque"
              rightLabel="transparent"
            />
          )}
          {game.exact_anchor_match && game.exact_target_match && (
            <div
              style={{
                color: 'var(--gold)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                marginTop: 'var(--space-sm)',
              }}
            >
              Perfect match!
            </div>
          )}
        </Panel>
      )}

      {/* Comparison insight */}
      {(hasHaikuBridge || hasHumanBridge) && (
        <Panel
          style={{
            background: 'transparent',
            borderColor: 'var(--gold-dim)',
            marginBottom: 'var(--space-lg)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              color: 'var(--faded)',
            }}
          >
            {hasHumanBridge && haikuBridgeSimilarity !== undefined && bridgeSimilarity !== undefined ? (
              bridgeSimilarity > haikuBridgeSimilarity ? (
                <>
                  <strong style={{ color: 'var(--text-light)' }}>
                    Your human recipient matched your thinking better than Haiku!
                  </strong>
                  <br />
                  Human: {Math.round(bridgeSimilarity)}% similarity vs Haiku: {Math.round(haikuBridgeSimilarity)}%
                </>
              ) : bridgeSimilarity < haikuBridgeSimilarity ? (
                <>
                  <strong style={{ color: 'var(--text-light)' }}>
                    Haiku matched your thinking better than your human recipient.
                  </strong>
                  <br />
                  Haiku: {Math.round(haikuBridgeSimilarity)}% similarity vs Human: {Math.round(bridgeSimilarity)}%
                </>
              ) : (
                <>
                  <strong style={{ color: 'var(--text-light)' }}>
                    Human and Haiku matched your bridge equally well.
                  </strong>
                  <br />
                  Both: {Math.round(bridgeSimilarity)}% similarity
                </>
              )
            ) : hasHaikuBridge && haikuBridgeSimilarity !== undefined ? (
              <>
                Haiku approached this bridge with {Math.round(haikuBridgeSimilarity)}% similarity to your thinking.
                <br />
                Share with a friend to see how a human compares!
              </>
            ) : hasHumanBridge && bridgeSimilarity !== undefined ? (
              <>
                Your recipient's bridge was {Math.round(bridgeSimilarity)}% similar to yours.
              </>
            ) : null}
          </div>
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
