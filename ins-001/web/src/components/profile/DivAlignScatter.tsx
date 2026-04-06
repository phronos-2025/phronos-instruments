/**
 * Divergence vs Alignment Scatterplot
 *
 * Chart.js scatter: x = divergence, y = alignment, dot size = parsimony.
 * Current user's dots highlighted in gold, peers in grey.
 */

import React from 'react';
import { Scatter } from 'react-chartjs-2';
import { CHART_COLORS, METRIC_COLORS, baseChartOptions } from '../../lib/chart-config';

interface DataPoint {
  sender_id: string;
  game_number: number;
  divergence: number;
  alignment: number;
  parsimony: number | null;
  is_current_user: boolean;
}

interface Props {
  data: DataPoint[];
}

export function DivAlignScatter({ data }: Props) {
  const userPoints = data.filter(d => d.is_current_user);
  const peerPoints = data.filter(d => !d.is_current_user);

  const chartData = {
    datasets: [
      {
        label: 'Other participants',
        data: peerPoints.map(d => ({
          x: d.divergence,
          y: d.alignment,
        })),
        backgroundColor: CHART_COLORS.peer,
        borderColor: CHART_COLORS.peerBorder,
        borderWidth: 1,
        pointRadius: peerPoints.map(d => {
          const p = d.parsimony ?? 0.5;
          return 3 + p * 6;
        }),
      },
      {
        label: 'You',
        data: userPoints.map(d => ({
          x: d.divergence,
          y: d.alignment,
        })),
        backgroundColor: CHART_COLORS.goldDim,
        borderColor: CHART_COLORS.gold,
        borderWidth: 2,
        pointRadius: userPoints.map(d => {
          const p = d.parsimony ?? 0.5;
          return 5 + p * 8;
        }),
      },
    ],
  };

  const options = {
    ...baseChartOptions('Divergence vs Alignment'),
    scales: {
      x: {
        title: {
          display: true,
          text: 'Divergence',
          color: CHART_COLORS.faded,
          font: { family: "'Fira Code', monospace", size: 10 },
        },
        ticks: { color: CHART_COLORS.faded, font: { family: "'Fira Code', monospace", size: 9 } },
        grid: { color: CHART_COLORS.grid },
      },
      y: {
        title: {
          display: true,
          text: 'Alignment',
          color: CHART_COLORS.faded,
          font: { family: "'Fira Code', monospace", size: 10 },
        },
        min: 0,
        max: 1,
        ticks: { color: CHART_COLORS.faded, font: { family: "'Fira Code', monospace", size: 9 } },
        grid: { color: CHART_COLORS.grid },
      },
    },
    plugins: {
      ...baseChartOptions('Divergence vs Alignment').plugins,
      tooltip: {
        ...baseChartOptions().plugins.tooltip,
        callbacks: {
          label: (ctx: any) => {
            const d = ctx.dataset.label === 'You' ? userPoints[ctx.dataIndex] : peerPoints[ctx.dataIndex];
            if (!d) return '';
            return `Game ${d.game_number}: Div=${d.divergence.toFixed(1)}, Ali=${(d.alignment * 100).toFixed(0)}%`;
          },
        },
      },
    },
  };

  return (
    <div style={{ height: '300px' }}>
      <Scatter data={chartData} options={options as any} />
    </div>
  );
}
