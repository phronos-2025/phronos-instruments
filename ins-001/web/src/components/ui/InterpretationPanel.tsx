/**
 * InterpretationPanel Component
 *
 * Unified interpretation panel for INS-001 instruments.
 * Follows brand guidelines: observational, not evaluative.
 *
 * Features:
 * - Consistent styling across instruments
 * - Optional methodology link
 * - Monospace headers, body-serif interpretation text
 */

import React from 'react';
import { Panel } from './Panel';
import { METHODS_LINK } from '../../lib/interpretation';

interface InterpretationPanelProps {
  children: React.ReactNode;
  methodsLink?: string;
  methodsNote?: string;
}

export const InterpretationPanel: React.FC<InterpretationPanelProps> = ({
  children,
  methodsLink = METHODS_LINK,
  methodsNote,
}) => {
  return (
    <Panel style={{ background: 'transparent', borderColor: 'var(--faded-light)' }}>
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
        {children}

        {/* Methodology note and link */}
        {(methodsNote || methodsLink) && (
          <div
            style={{
              marginTop: 'var(--space-md)',
              paddingTop: 'var(--space-sm)',
              borderTop: '1px solid var(--border)',
              fontStyle: 'italic',
              fontSize: '0.8rem',
            }}
          >
            {methodsNote && <p style={{ margin: 0, marginBottom: 'var(--space-xs)' }}>{methodsNote}</p>}
            {methodsLink && (
              <a
                href={methodsLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: 'var(--gold)',
                  textDecoration: 'none',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.7rem',
                  letterSpacing: '0.5px',
                }}
              >
                View methodology →
              </a>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
};

// =============================================================================
// METRIC ROW COMPONENT
// =============================================================================

interface MetricRowProps {
  label: string;
  score: number | string;
  band: string;
  observation: string;
  implication?: string;
  color?: string;
}

export const MetricRow: React.FC<MetricRowProps> = ({
  label,
  score,
  band,
  observation,
  implication,
  color,
}) => {
  return (
    <div style={{ marginBottom: 'var(--space-md)' }}>
      {/* Header: Label (Score) — Band */}
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
          marginBottom: 'var(--space-xs)',
          display: 'flex',
          alignItems: 'baseline',
          gap: 'var(--space-xs)',
        }}
      >
        <span style={{ fontWeight: 600, color: color || 'var(--text-light)' }}>
          {label} ({typeof score === 'number' ? Math.round(score) : score})
        </span>
        <span style={{ color: 'var(--faded)' }}>—</span>
        <span style={{ color: color || 'var(--gold)' }}>{band}</span>
      </div>

      {/* Observation */}
      <p style={{ margin: 0, marginBottom: implication ? 'var(--space-xs)' : 0 }}>{observation}</p>

      {/* Implication (optional) */}
      {implication && (
        <p style={{ margin: 0, opacity: 0.8, fontSize: '0.85rem' }}>{implication}</p>
      )}
    </div>
  );
};

// =============================================================================
// COMPARISON ROW COMPONENT
// =============================================================================

interface ComparisonRowProps {
  text: string;
}

export const ComparisonRow: React.FC<ComparisonRowProps> = ({ text }) => {
  return (
    <p
      style={{
        margin: 0,
        marginTop: 'var(--space-xs)',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.75rem',
        color: 'var(--faded)',
      }}
    >
      {text}
    </p>
  );
};

export default InterpretationPanel;
