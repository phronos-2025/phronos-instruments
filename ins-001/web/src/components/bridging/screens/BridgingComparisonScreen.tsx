/**
 * Bridging Comparison Screen - INS-001.2 V2
 *
 * Shows side-by-side comparison of sender's union vs recipient's union.
 */

import React from 'react';
import { Panel } from '../../ui/Panel';
import { Button } from '../../ui/Button';

interface BridgingComparisonScreenProps {
  anchor: string;
  target: string;
  senderSteps: string[];
  recipientSteps: string[];
  bridgeSimilarity: number;
  centroidSimilarity: number;
  pathAlignment: number;
  senderDivergence: number;
  recipientDivergence: number;
}

function ScoreBar({ score, color = 'var(--gold)' }: { score: number; color?: string }) {
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
          background: color,
          height: '100%',
          width: `${Math.min(100, score)}%`,
          transition: 'width 0.3s ease',
        }}
      />
    </div>
  );
}

function getSimilarityInterpretation(score: number): { text: string; description: string } {
  if (score >= 80) {
    return {
      text: 'Highly similar unions',
      description: 'You and the sender navigated this connection almost identically.',
    };
  } else if (score >= 60) {
    return {
      text: 'Similar unions',
      description: 'You took a related conceptual path between these words.',
    };
  } else if (score >= 40) {
    return {
      text: 'Different approaches',
      description: 'You found a distinct route connecting these concepts.',
    };
  } else {
    return {
      text: 'Divergent unions',
      description: 'You and the sender had very different ways of connecting these ideas.',
    };
  }
}

function getDivergenceLabel(divergence: number): string {
  if (divergence >= 60) return 'creative';
  if (divergence >= 40) return 'moderate';
  return 'direct';
}

export const BridgingComparisonScreen: React.FC<BridgingComparisonScreenProps> = ({
  anchor,
  target,
  senderSteps,
  recipientSteps,
  bridgeSimilarity,
  centroidSimilarity,
  pathAlignment,
  senderDivergence,
  recipientDivergence,
}) => {
  const interpretation = getSimilarityInterpretation(bridgeSimilarity);
  const senderMoreCreative = senderDivergence > recipientDivergence;

  return (
    <div>
      <p className="subtitle">
        <span className="id">INS-001.2</span> · Union Comparison
      </p>
      <h1 className="title">{interpretation.text}</h1>

      {/* Anchor ←→ Target header */}
      <div
        style={{
          textAlign: 'center',
          marginBottom: 'var(--space-lg)',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '1.1rem',
            color: 'var(--gold)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-md)',
          }}
        >
          <span style={{ fontWeight: 600 }}>{anchor}</span>
          <span
            style={{
              color: 'var(--faded)',
              fontSize: '0.9rem',
              letterSpacing: '0.1em',
            }}
          >
            ←――――――――――→
          </span>
          <span style={{ fontWeight: 600 }}>{target}</span>
        </div>
      </div>

      {/* Side-by-side unions */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--space-md)',
          marginBottom: 'var(--space-lg)',
        }}
      >
        {/* Sender's union */}
        <div
          style={{
            padding: 'var(--space-md)',
            background: 'var(--bg-card)',
            borderRadius: '8px',
            border: '1px solid var(--border)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.7rem',
              color: 'var(--faded)',
              marginBottom: 'var(--space-sm)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Their Union
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
              color: 'var(--text-light)',
              lineHeight: '1.8',
            }}
          >
            {senderSteps.map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                <span style={{ color: 'var(--faded)', fontSize: '0.7rem' }}>•</span>
                <span>{step}</span>
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: 'var(--space-sm)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.65rem',
              color: 'var(--faded)',
            }}
          >
            {getDivergenceLabel(senderDivergence)} path ({Math.round(senderDivergence)}%)
          </div>
        </div>

        {/* Recipient's union */}
        <div
          style={{
            padding: 'var(--space-md)',
            background: 'var(--bg-card)',
            borderRadius: '8px',
            border: '1px solid var(--gold-dim)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.7rem',
              color: 'var(--gold)',
              marginBottom: 'var(--space-sm)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Your Union
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
              color: 'var(--text-light)',
              lineHeight: '1.8',
            }}
          >
            {recipientSteps.map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                <span style={{ color: 'var(--gold)', fontSize: '0.7rem' }}>•</span>
                <span>{step}</span>
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: 'var(--space-sm)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.65rem',
              color: 'var(--faded)',
            }}
          >
            {getDivergenceLabel(recipientDivergence)} path ({Math.round(recipientDivergence)}%)
          </div>
        </div>
      </div>

      {/* Union Similarity Score */}
      <Panel
        title="Union Similarity"
        meta={`${Math.round(bridgeSimilarity)}%`}
        style={{ marginBottom: 'var(--space-md)' }}
      >
        <ScoreBar score={bridgeSimilarity} />
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
          <span>divergent</span>
          <span>identical</span>
        </div>
      </Panel>

      {/* Detailed metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--space-md)',
          marginBottom: 'var(--space-lg)',
        }}
      >
        {/* Centroid Similarity */}
        <div
          style={{
            padding: 'var(--space-md)',
            background: 'var(--bg-card)',
            borderRadius: '8px',
            border: '1px solid var(--border)',
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
                fontSize: '0.7rem',
                color: 'var(--faded)',
              }}
            >
              Semantic Center
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                color: 'var(--text-light)',
              }}
            >
              {Math.round(centroidSimilarity)}%
            </span>
          </div>
          <ScoreBar score={centroidSimilarity} color="var(--text-light)" />
        </div>

        {/* Path Alignment */}
        <div
          style={{
            padding: 'var(--space-md)',
            background: 'var(--bg-card)',
            borderRadius: '8px',
            border: '1px solid var(--border)',
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
                fontSize: '0.7rem',
                color: 'var(--faded)',
              }}
            >
              Path Alignment
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                color: 'var(--text-light)',
              }}
            >
              {Math.round(pathAlignment)}%
            </span>
          </div>
          <ScoreBar score={pathAlignment} color="var(--text-light)" />
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
          <strong style={{ color: 'var(--text-light)' }}>{interpretation.description}</strong>
          <br />
          <br />
          {senderMoreCreative ? (
            <>
              The sender took a more creative route ({Math.round(senderDivergence)}% divergence)
              while you stayed closer to the direct path ({Math.round(recipientDivergence)}%).
            </>
          ) : senderDivergence < recipientDivergence ? (
            <>
              You took a more creative route ({Math.round(recipientDivergence)}% divergence)
              while they stayed closer to the direct path ({Math.round(senderDivergence)}%).
            </>
          ) : (
            <>
              Both unions had similar levels of creativity (~{Math.round(senderDivergence)}% divergence).
            </>
          )}
        </div>
      </Panel>

      <div className="btn-group" style={{ justifyContent: 'center' }}>
        <Button variant="primary" onClick={() => (window.location.href = '/ins-001-2')}>
          Build Your Own Union
        </Button>
      </div>
    </div>
  );
};
