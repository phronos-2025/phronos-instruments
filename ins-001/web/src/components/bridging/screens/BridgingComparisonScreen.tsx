/**
 * Bridging Comparison Screen - INS-001.2 V2
 *
 * Shows side-by-side comparison of sender's union vs recipient's union,
 * plus Haiku and Statistical baselines in a dot plot visualization.
 */

import React from 'react';
import { Panel } from '../../ui/Panel';
import { Button } from '../../ui/Button';

interface BridgingComparisonScreenProps {
  anchor: string;
  target: string;
  // Sender (Them)
  senderSteps: string[];
  senderRelevance?: number;
  senderDivergence: number;
  // Recipient (You)
  recipientSteps: string[];
  recipientRelevance?: number;
  recipientDivergence: number;
  // Bridge comparison
  bridgeSimilarity: number;
  // Haiku baseline
  haikuClues?: string[];
  haikuRelevance?: number;
  haikuDivergence?: number;
  // Statistical baseline
  lexicalBridge?: string[];
  lexicalRelevance?: number;
  lexicalDivergence?: number;
}

interface DotPlotRowProps {
  label: string;
  concepts: string[];
  relevance: number;
  spread: number;
  isYou?: boolean;
}

// Single row in the connected dot plot
function DotPlotRow({ label, concepts, relevance, spread, isYou }: DotPlotRowProps) {
  const scale = (val: number) => Math.min(100, Math.max(0, val));

  return (
    <div style={{ marginBottom: 'var(--space-lg)' }}>
      {/* Concepts above the track - offset to align with track, not label */}
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
          color: isYou ? 'var(--gold)' : 'var(--text-light)',
          marginBottom: 'var(--space-xs)',
          letterSpacing: '0.02em',
          textAlign: 'center',
          marginLeft: '92px', // 80px label + 12px gap (--space-sm)
        }}
      >
        {concepts.join(' · ')}
      </div>

      {/* Row with label, track, and delta */}
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
              left: `${scale(relevance)}%`,
              width: `${Math.max(0, scale(spread) - scale(relevance))}%`,
              top: '50%',
              height: '2px',
              backgroundColor: 'var(--gold)',
              opacity: 0.4,
              transform: 'translateY(-50%)',
            }}
          />

          {/* Relevance dot (filled) */}
          <div
            style={{
              position: 'absolute',
              left: `${scale(relevance)}%`,
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: 'var(--gold)',
            }}
          />

          {/* Spread dot (hollow) */}
          <div
            style={{
              position: 'absolute',
              left: `${scale(spread)}%`,
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
              left: `${scale(relevance)}%`,
              bottom: '-16px',
              transform: 'translateX(-50%)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6rem',
              color: 'var(--gold)',
            }}
          >
            {Math.round(relevance)}
          </span>
          <span
            style={{
              position: 'absolute',
              left: `${scale(spread)}%`,
              bottom: '-16px',
              transform: 'translateX(-50%)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6rem',
              color: 'var(--faded)',
            }}
          >
            {Math.round(spread)}
          </span>
        </div>
      </div>
    </div>
  );
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
      text: 'Highly similar common ground',
      description: 'You and the sender navigated this connection almost identically.',
    };
  } else if (score >= 60) {
    return {
      text: 'Similar common ground',
      description: 'You took a related conceptual path between these words.',
    };
  } else if (score >= 40) {
    return {
      text: 'Different approaches',
      description: 'You found a distinct route connecting these concepts.',
    };
  } else {
    return {
      text: 'Divergent common ground',
      description: 'You and the sender had very different ways of connecting these ideas.',
    };
  }
}

export const BridgingComparisonScreen: React.FC<BridgingComparisonScreenProps> = ({
  anchor,
  target,
  senderSteps,
  senderRelevance,
  senderDivergence,
  recipientSteps,
  recipientRelevance,
  recipientDivergence,
  bridgeSimilarity,
  haikuClues,
  haikuRelevance,
  haikuDivergence,
  lexicalBridge,
  lexicalRelevance,
  lexicalDivergence,
}) => {
  const interpretation = getSimilarityInterpretation(bridgeSimilarity);

  // Convert relevance from 0-1 to 0-100 if needed
  const normalizeRelevance = (r?: number) => {
    if (r === undefined || r === null) return 0;
    return r <= 1 ? r * 100 : r;
  };

  const youRelevance = normalizeRelevance(recipientRelevance);
  const themRelevance = normalizeRelevance(senderRelevance);
  const haikuRel = normalizeRelevance(haikuRelevance);
  const statRel = normalizeRelevance(lexicalRelevance);

  const hasHaiku = haikuClues && haikuClues.length > 0 && haikuRelevance !== undefined && haikuDivergence !== undefined;
  const hasStatistical = lexicalBridge && lexicalBridge.length > 0 && lexicalRelevance !== undefined && lexicalDivergence !== undefined;

  return (
    <div>
      <p className="subtitle">
        <span className="id">INS-001.2</span> · Common Ground Comparison
      </p>
      <h1 className="title">{interpretation.text}</h1>

      <Panel>
        {/* Semantic axis */}
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
            color: 'var(--gold)',
            textAlign: 'center',
            marginBottom: 'var(--space-lg)',
          }}
        >
          {anchor} ←―――――――――――――――――――――→ {target}
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
            <span>Relevance</span>
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
            <span>Spread</span>
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

        {/* Data rows */}
        <div style={{ marginTop: 'var(--space-md)' }}>
          {/* Your row (recipient) */}
          <DotPlotRow
            label="You"
            concepts={recipientSteps}
            relevance={youRelevance}
            spread={recipientDivergence}
            isYou
          />

          {/* Their row (sender) */}
          <DotPlotRow
            label="Them"
            concepts={senderSteps}
            relevance={themRelevance}
            spread={senderDivergence}
          />

          {/* Haiku row */}
          {hasHaiku && (
            <DotPlotRow
              label="Haiku"
              concepts={haikuClues}
              relevance={haikuRel}
              spread={haikuDivergence}
            />
          )}

          {/* Statistical row */}
          {hasStatistical && (
            <DotPlotRow
              label="Statistical"
              concepts={lexicalBridge}
              relevance={statRel}
              spread={lexicalDivergence}
            />
          )}
        </div>
      </Panel>

      {/* Common Ground Similarity Score */}
      <Panel
        title="Common Ground Similarity"
        meta={`${Math.round(bridgeSimilarity)}%`}
        style={{ marginTop: 'var(--space-md)' }}
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

      {/* Interpretation */}
      <Panel
        style={{
          background: 'transparent',
          borderColor: 'var(--gold-dim)',
          marginTop: 'var(--space-md)',
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
        </div>
      </Panel>

      <div className="btn-group" style={{ justifyContent: 'center', marginTop: 'var(--space-lg)' }}>
        <Button variant="primary" onClick={() => (window.location.href = '/ins-001/ins-001-2/')}>
          Find Your Own Common Ground
        </Button>
      </div>
    </div>
  );
};
