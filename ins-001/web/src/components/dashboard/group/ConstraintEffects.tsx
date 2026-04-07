/**
 * Constraint Effects — Paired distribution comparison for item 4 (5,3) vs item 8 (3,5).
 * Shows parsimony and alignment distributions side by side.
 */

import React from 'react';
import { Bar } from 'react-chartjs-2';
import { CHART_COLORS, METRIC_COLORS, baseChartOptions } from '../../../lib/chart-config';

interface UserItem {
  item_number: number;
  game_type: string;
  m: number | null;
  n: number | null;
  divergence: number | null;
  alignment: number | null;
  parsimony: number | null;
}

interface Props {
  effects: {
    item_4_parsimony: number[];
    item_8_parsimony: number[];
    item_4_alignment: number[];
    item_8_alignment: number[];
  };
  userScores?: UserItem[];
}

function computeStats(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const median = n % 2 === 1 ? sorted[Math.floor(n / 2)] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  const q1 = sorted[Math.floor(n * 0.25)];
  const q3 = sorted[Math.floor(n * 0.75)];
  const iqr = q3 - q1;
  const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(n - 1, 1));
  return { mean, median, q1, q3, iqr, sd, min: sorted[0], max: sorted[n - 1] };
}

function StatRow({ label, config, values, color, userValue }: { label: string; config: string; values: number[]; color: string; userValue?: number }) {
  const stats = computeStats(values);
  const range = stats.max - stats.min || 1;

  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.25rem' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-light)' }}>
          {label} <span style={{ color: 'var(--faded)' }}>({config})</span>
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--faded)' }}>
          median: {stats.median.toFixed(2)}&nbsp;&nbsp;IQR: {stats.iqr.toFixed(2)}
          {userValue != null && (
            <>&nbsp;&nbsp;<span style={{ color: '#C9A063' }}>you: {userValue.toFixed(2)}</span></>
          )}
        </span>
      </div>
      <div style={{ position: 'relative', height: '24px', background: 'var(--faded-ultra)', borderRadius: '2px' }}>
        {/* IQR box */}
        <div style={{
          position: 'absolute',
          left: `${((stats.q1 - stats.min) / range) * 100}%`,
          width: `${((stats.q3 - stats.q1) / range) * 100}%`,
          top: '4px',
          height: '16px',
          background: color + '44',
          border: `1px solid ${color}`,
          borderRadius: '1px',
        }} />
        {/* Median line */}
        <div style={{
          position: 'absolute',
          left: `${((stats.median - stats.min) / range) * 100}%`,
          top: '2px',
          height: '20px',
          width: '2px',
          background: color,
        }} />
        {/* User marker (gold diamond) */}
        {userValue != null && (
          <div style={{
            position: 'absolute',
            left: `${((userValue - stats.min) / range) * 100}%`,
            top: '4px',
            width: '10px',
            height: '10px',
            background: '#C9A063',
            border: '1.5px solid #C9A063',
            borderRadius: '1px',
            transform: 'translate(-50%, 0) rotate(45deg)',
          }} />
        )}
      </div>
    </div>
  );
}

export function ConstraintEffects({ effects, userScores }: Props) {
  const user4 = userScores?.find(s => s.item_number === 4);
  const user8 = userScores?.find(s => s.item_number === 8);

  return (
    <div>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.65rem',
        textTransform: 'uppercase' as const,
        letterSpacing: '2px',
        color: 'var(--gold)',
        marginBottom: '0.5rem',
      }}>Constraint Effects</div>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--faded)', marginBottom: '1.5rem' }}>
        Parsimony by task structure
      </p>

      <StatRow label="Item 4" config="5 targets, 3 words" values={effects.item_4_parsimony} color={METRIC_COLORS.parsimony} userValue={user4?.parsimony ?? undefined} />
      <StatRow label="Item 8" config="3 targets, 5 words" values={effects.item_8_parsimony} color={METRIC_COLORS.parsimony} userValue={user8?.parsimony ?? undefined} />

      <div style={{ height: '1px', background: 'var(--faded-light)', margin: '1.5rem 0' }} />

      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--faded)', marginBottom: '1.5rem' }}>
        Alignment by task structure
      </p>

      <StatRow label="Item 4" config="5 targets, 3 words" values={effects.item_4_alignment} color={METRIC_COLORS.alignment} userValue={user4?.alignment ?? undefined} />
      <StatRow label="Item 8" config="3 targets, 5 words" values={effects.item_8_alignment} color={METRIC_COLORS.alignment} userValue={user8?.alignment ?? undefined} />

      <p style={{
        fontFamily: 'var(--font-body)',
        fontSize: '0.875rem',
        color: 'var(--faded)',
        fontStyle: 'italic',
        marginTop: '1.5rem',
        lineHeight: 1.6,
      }}>
        When associations outnumber targets, parsimony variance increases — the gap between efficient and redundant responses widens.
      </p>
    </div>
  );
}
