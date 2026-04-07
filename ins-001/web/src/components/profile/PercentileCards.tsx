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

function MiniHistogram({ percentile, color }: { percentile: number; color: string }) {
  const bars = 20;
  const barWidth = 200 / bars;
  const userBar = Math.min(Math.floor(percentile / (100 / bars)), bars - 1);

  return (
    <svg
      viewBox="0 0 200 44"
      style={{ width: '100%', height: '40px', marginTop: 'var(--space-sm)' }}
      preserveAspectRatio="none"
    >
      {Array.from({ length: bars }, (_, i) => {
        // Gaussian bell shape centered at bar 10 (50th percentile)
        const h = 32 * Math.exp(-0.5 * ((i - 10) / 4) ** 2);
        const isUser = i === userBar;
        return (
          <rect
            key={i}
            x={i * barWidth + 1}
            y={40 - h}
            width={barWidth - 2}
            height={h}
            fill={isUser ? color : 'rgba(242, 240, 233, 0.08)'}
            opacity={isUser ? 0.6 : 1}
            rx={1}
          />
        );
      })}
      {/* User position marker line */}
      <line
        x1={(percentile / 100) * 200}
        y1={2}
        x2={(percentile / 100) * 200}
        y2={42}
        stroke={color}
        strokeWidth={2}
        opacity={0.9}
      />
    </svg>
  );
}

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

            {/* Mini histogram with user position */}
            <MiniHistogram percentile={value} color={meta.color} />
          </div>
        );
      })}
    </div>
  );
}
