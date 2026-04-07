/**
 * Divergence × Alignment Scatterplot — All Bridge games across all participants.
 * Color-coded by item number, dot size = parsimony.
 */

import React from 'react';
import { Scatter } from 'react-chartjs-2';
import { CHART_COLORS, baseChartOptions } from '../../../lib/chart-config';

interface DataPoint {
  item_number: number;
  divergence: number;
  alignment: number;
  parsimony: number | null;
  m: number;
  n: number;
}

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
  data: DataPoint[];
  userScores?: UserItem[];
}

const ITEM_COLORS: Record<number, { bg: string; border: string; label: string }> = {
  3:  { bg: 'rgba(107, 143, 212, 0.35)', border: '#6B8FD4', label: 'Item 3 (5,5)' },
  4:  { bg: 'rgba(201, 160, 99, 0.35)', border: '#C9A063', label: 'Item 4 (5,3)' },
  8:  { bg: 'rgba(68, 170, 119, 0.35)', border: '#44AA77', label: 'Item 8 (3,5)' },
  10: { bg: 'rgba(170, 100, 180, 0.35)', border: '#AA64B4', label: 'Item 10 (5,5)' },
};

export function DivAlignScatterAll({ data, userScores }: Props) {
  const itemGroups = new Map<number, DataPoint[]>();
  for (const d of data) {
    if (!itemGroups.has(d.item_number)) itemGroups.set(d.item_number, []);
    itemGroups.get(d.item_number)!.push(d);
  }

  const datasets = Array.from(itemGroups.entries())
    .sort(([a], [b]) => a - b)
    .map(([itemNum, points]) => {
      const colors = ITEM_COLORS[itemNum] || { bg: CHART_COLORS.peer, border: CHART_COLORS.peerBorder, label: `Item ${itemNum}` };
      return {
        label: colors.label,
        data: points.map(d => ({ x: d.divergence, y: d.alignment })),
        backgroundColor: colors.bg,
        borderColor: colors.border,
        borderWidth: 1.5,
        pointRadius: points.map(d => {
          const p = d.parsimony ?? 0.5;
          return 4 + p * 8;
        }),
      };
    });

  // Add user's Bridge items as a highlighted dataset
  if (userScores) {
    const userBridge = userScores.filter(s =>
      s.game_type === 'bridge' && s.divergence != null && s.alignment != null
    );
    if (userBridge.length > 0) {
      datasets.push({
        label: 'You',
        data: userBridge.map(s => ({ x: s.divergence!, y: s.alignment! })),
        backgroundColor: CHART_COLORS.goldDim,
        borderColor: CHART_COLORS.gold,
        borderWidth: 2.5,
        pointRadius: userBridge.map(s => {
          const p = s.parsimony ?? 0.5;
          return 6 + p * 10;
        }),
        pointStyle: 'rectRot' as const,
      } as any);
    }
  }

  const options = {
    ...baseChartOptions('Alignment vs Divergence'),
    scales: {
      x: {
        title: {
          display: true,
          text: 'Divergence',
          color: CHART_COLORS.faded,
          font: { family: "'Fira Code', monospace", size: 11 },
        },
        ticks: { color: CHART_COLORS.faded, font: { family: "'Fira Code', monospace", size: 10 } },
        grid: { color: CHART_COLORS.grid },
      },
      y: {
        title: {
          display: true,
          text: 'Alignment',
          color: CHART_COLORS.faded,
          font: { family: "'Fira Code', monospace", size: 11 },
        },
        min: 0,
        max: 100,
        ticks: { color: CHART_COLORS.faded, font: { family: "'Fira Code', monospace", size: 10 } },
        grid: { color: CHART_COLORS.grid },
      },
    },
    plugins: {
      ...baseChartOptions('Alignment vs Divergence').plugins,
      legend: {
        display: true,
        labels: {
          color: CHART_COLORS.faded,
          font: { family: "'Fira Code', monospace", size: 11 },
          usePointStyle: true,
          pointStyle: 'circle',
        },
      },
      tooltip: {
        ...baseChartOptions().plugins.tooltip,
        callbacks: {
          label: (ctx: any) => {
            const dsLabel = ctx.dataset.label || '';
            return `${dsLabel}: Div=${ctx.parsed.x.toFixed(1)}, Ali=${Math.round(ctx.parsed.y)}%`;
          },
        },
      },
    },
  };

  return (
    <div>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.65rem',
        textTransform: 'uppercase' as const,
        letterSpacing: '2px',
        color: 'var(--gold)',
        marginBottom: '0.5rem',
      }}>Alignment vs Divergence</div>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--faded)', marginBottom: '1rem' }}>
        All Bridge games across all participants · Dot size = parsimony
      </p>
      <div style={{ height: '400px' }}>
        <Scatter data={{ datasets }} options={options as any} />
      </div>
    </div>
  );
}
