/**
 * Aggregate Percentile Cards
 *
 * Three cards showing mean percentile for divergence, alignment, parsimony.
 */

import React from 'react';

interface Props {
  percentiles: Record<string, number>;
}

const METRIC_META: Record<string, { label: string; color: string }> = {
  divergence: { label: 'Divergence', color: '#C9A063' },
  alignment: { label: 'Alignment', color: '#44AA77' },
  parsimony: { label: 'Parsimony', color: '#6B8FD4' },
};

export function PercentileCards({ percentiles }: Props) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 'var(--space-md)',
    }}>
      {Object.entries(METRIC_META).map(([key, meta]) => {
        const value = percentiles[key];
        if (value === undefined || value === null) return null;

        return (
          <div key={key} style={{
            textAlign: 'center',
            padding: 'var(--space-md)',
            border: '1px solid var(--faded-light)',
            background: 'rgba(255,255,255,0.02)',
          }}>
            <p style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6rem',
              color: 'var(--faded)',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: 'var(--space-xs)',
            }}>
              {meta.label}
            </p>

            <p style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '2rem',
              fontWeight: 600,
              color: meta.color,
              lineHeight: 1,
            }}>
              {Math.round(value)}
              <span style={{ fontSize: '0.7rem', color: 'var(--faded)' }}>th</span>
            </p>

            <p style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6rem',
              color: 'var(--faded)',
              marginTop: '4px',
            }}>
              percentile
            </p>

            {/* Simple visual bar */}
            <div style={{
              marginTop: 'var(--space-sm)',
              height: '4px',
              background: 'var(--faded-light)',
              borderRadius: '2px',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${value}%`,
                background: meta.color,
                transition: 'width 0.5s ease',
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
