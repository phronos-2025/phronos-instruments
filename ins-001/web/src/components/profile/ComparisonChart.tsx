/**
 * Comparison Chart — Horizontal bar chart comparing two items.
 *
 * Used for both Bridge retest (item 3 vs 10) and
 * asymmetric constraint comparison (item 4 vs 8).
 */

import React from 'react';
import { Bar } from 'react-chartjs-2';
import { CHART_COLORS, METRIC_COLORS, baseChartOptions } from '../../lib/chart-config';

interface ComparisonData {
  label: string;
  earlier: { item_number: number; scores: Record<string, number | boolean> };
  later: { item_number: number; scores: Record<string, number | boolean> };
}

interface Props {
  comparison: ComparisonData;
}

const METRICS = ['divergence', 'alignment', 'parsimony'] as const;
const METRIC_LABELS: Record<string, string> = {
  divergence: 'Divergence',
  alignment: 'Alignment',
  parsimony: 'Parsimony',
};

function formatDelta(earlier: number, later: number, metric: string): string {
  const diff = later - earlier;
  const sign = diff >= 0 ? '+' : '';
  if (metric === 'divergence') return `${sign}${diff.toFixed(1)}`;
  return `${sign}${(diff * 100).toFixed(0)}%`;
}

function formatValue(value: number, metric: string): string {
  if (metric === 'divergence') return value.toFixed(1);
  return `${(value * 100).toFixed(0)}%`;
}

export function ComparisonChart({ comparison }: Props) {
  const { earlier, later } = comparison;

  // Only show metrics that exist in both items
  const availableMetrics = METRICS.filter(
    m => typeof earlier.scores[m] === 'number' && typeof later.scores[m] === 'number'
  );

  if (availableMetrics.length === 0) return null;

  return (
    <div>
      <p style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.65rem',
        color: 'var(--faded)',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        marginBottom: 'var(--space-xs)',
      }}>
        {comparison.label}
      </p>
      <p style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.6rem',
        color: 'var(--faded)',
        marginBottom: 'var(--space-md)',
        opacity: 0.7,
      }}>
        Item {earlier.item_number} vs Item {later.item_number}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
        {availableMetrics.map(metric => {
          const earlyVal = earlier.scores[metric] as number;
          const laterVal = later.scores[metric] as number;
          const delta = laterVal - earlyVal;
          const maxVal = metric === 'divergence' ? 100 : 1;
          const color = METRIC_COLORS[metric];

          return (
            <div key={metric} style={{
              display: 'grid',
              gridTemplateColumns: '80px 1fr 60px',
              alignItems: 'center',
              gap: 'var(--space-xs)',
            }}>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.6rem',
                color: 'var(--faded)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}>
                {METRIC_LABELS[metric]}
              </span>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {/* Earlier bar */}
                <div style={{
                  height: '8px',
                  background: 'var(--faded-light)',
                  borderRadius: '1px',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${(earlyVal / maxVal) * 100}%`,
                    background: color,
                    opacity: 0.4,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
                {/* Later bar */}
                <div style={{
                  height: '8px',
                  background: 'var(--faded-light)',
                  borderRadius: '1px',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${(laterVal / maxVal) * 100}%`,
                    background: color,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>

              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.65rem',
                color: delta >= 0 ? CHART_COLORS.active : CHART_COLORS.alert,
                textAlign: 'right',
              }}>
                {formatDelta(earlyVal, laterVal, metric)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex',
        gap: 'var(--space-md)',
        marginTop: 'var(--space-sm)',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.55rem',
        color: 'var(--faded)',
      }}>
        <span style={{ opacity: 0.6 }}>
          ▪ Item {earlier.item_number} (earlier)
        </span>
        <span>
          ▪ Item {later.item_number} (later)
        </span>
      </div>
    </div>
  );
}
