/**
 * Bridging Guess Results Screen - INS-001.2
 *
 * Shows recipient's results after guessing the anchor-target pair.
 */

import React from 'react';
import { Panel } from '../../ui/Panel';
import { Button } from '../../ui/Button';

interface BridgingGuessResultsScreenProps {
  clues: string[];
  guessedAnchor: string;
  guessedTarget: string;
  trueAnchor: string;
  trueTarget: string;
  reconstructionScore: number;
  anchorSimilarity: number;
  targetSimilarity: number;
  orderSwapped: boolean;
  exactAnchorMatch: boolean;
  exactTargetMatch: boolean;
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        borderRadius: '4px',
        height: '8px',
        overflow: 'hidden',
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
  );
}

export const BridgingGuessResultsScreen: React.FC<BridgingGuessResultsScreenProps> = ({
  clues,
  guessedAnchor,
  guessedTarget,
  trueAnchor,
  trueTarget,
  reconstructionScore,
  anchorSimilarity,
  targetSimilarity,
  orderSwapped,
  exactAnchorMatch,
  exactTargetMatch,
}) => {
  const perfectMatch = exactAnchorMatch && exactTargetMatch;

  return (
    <div>
      <p className="subtitle">
        <span className="id">INS-001.2</span> · Results
      </p>
      <h1 className="title">
        {perfectMatch ? 'Perfect reconstruction!' : 'Bridge revealed.'}
      </h1>

      {/* True bridge reveal */}
      <div
        style={{
          textAlign: 'center',
          marginBottom: 'var(--space-lg)',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            color: 'var(--faded)',
            marginBottom: 'var(--space-xs)',
          }}
        >
          THE BRIDGE WAS:
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '1.1rem',
            color: 'var(--gold)',
            marginBottom: 'var(--space-sm)',
          }}
        >
          {trueAnchor} ←――――――――――――――――→ {trueTarget}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
            color: 'var(--text-light)',
          }}
        >
          {clues.join(' · ')}
        </div>
      </div>

      {/* Your guess */}
      <div
        style={{
          textAlign: 'center',
          marginBottom: 'var(--space-lg)',
          padding: 'var(--space-md)',
          background: 'var(--bg-card)',
          borderRadius: '8px',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            color: 'var(--faded)',
            marginBottom: 'var(--space-xs)',
          }}
        >
          YOUR GUESS:
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '1rem',
            color: 'var(--text-light)',
          }}
        >
          {guessedAnchor} ←→ {guessedTarget}
          {orderSwapped && (
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
      </div>

      {/* Overall reconstruction score */}
      <Panel
        title="Reconstruction Accuracy"
        meta={`${Math.round(reconstructionScore)}%`}
        style={{ marginBottom: 'var(--space-md)' }}
      >
        <ScoreBar score={reconstructionScore} />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.65rem',
            color: 'var(--faded)',
            marginTop: 'var(--space-xs)',
          }}
        >
          <span>opaque</span>
          <span>transparent</span>
        </div>
      </Panel>

      {/* Individual similarities */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--space-md)',
          marginBottom: 'var(--space-lg)',
        }}
      >
        {/* Anchor similarity */}
        <div
          style={{
            padding: 'var(--space-md)',
            background: 'var(--bg-card)',
            borderRadius: '8px',
            border: exactAnchorMatch ? '1px solid var(--gold)' : '1px solid var(--border)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--space-sm)',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                color: 'var(--faded)',
              }}
            >
              Anchor
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                color: exactAnchorMatch ? 'var(--gold)' : 'var(--text-light)',
              }}
            >
              {exactAnchorMatch ? '✓' : `${Math.round(anchorSimilarity)}%`}
            </span>
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              color: 'var(--text-light)',
            }}
          >
            {guessedAnchor}{' '}
            {!exactAnchorMatch && (
              <span style={{ color: 'var(--faded)' }}>
                → {orderSwapped ? trueTarget : trueAnchor}
              </span>
            )}
          </div>
        </div>

        {/* Target similarity */}
        <div
          style={{
            padding: 'var(--space-md)',
            background: 'var(--bg-card)',
            borderRadius: '8px',
            border: exactTargetMatch ? '1px solid var(--gold)' : '1px solid var(--border)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 'var(--space-sm)',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                color: 'var(--faded)',
              }}
            >
              Target
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                color: exactTargetMatch ? 'var(--gold)' : 'var(--text-light)',
              }}
            >
              {exactTargetMatch ? '✓' : `${Math.round(targetSimilarity)}%`}
            </span>
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              color: 'var(--text-light)',
            }}
          >
            {guessedTarget}{' '}
            {!exactTargetMatch && (
              <span style={{ color: 'var(--faded)' }}>
                → {orderSwapped ? trueAnchor : trueTarget}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Interpretation */}
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
          {perfectMatch ? (
            <>
              <strong style={{ color: 'var(--gold)' }}>Perfect match!</strong>
              <br />
              You successfully reconstructed the exact concepts the sender was
              bridging.
            </>
          ) : reconstructionScore >= 70 ? (
            <>
              <strong style={{ color: 'var(--text-light)' }}>
                Strong reconstruction.
              </strong>
              <br />
              You were in the right semantic neighborhood.
            </>
          ) : reconstructionScore >= 40 ? (
            <>
              <strong style={{ color: 'var(--text-light)' }}>
                Partial reconstruction.
              </strong>
              <br />
              The clues led you toward related concepts.
            </>
          ) : (
            <>
              <strong style={{ color: 'var(--text-light)' }}>
                The bridge was opaque.
              </strong>
              <br />
              The clues took a creative route that was hard to decode.
            </>
          )}
        </div>
      </Panel>

      <div className="btn-group" style={{ justifyContent: 'center' }}>
        <Button variant="primary" onClick={() => (window.location.href = '/ins-001-2')}>
          Build Your Own Bridge
        </Button>
      </div>
    </div>
  );
};
