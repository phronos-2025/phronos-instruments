/**
 * Learning Curve — Mean ± SE for each metric across generative items.
 * Shows battery position on X axis with a marker for the evaluative block.
 */

import React from 'react';
import { Line } from 'react-chartjs-2';
import { METRIC_COLORS, CHART_COLORS, baseChartOptions } from '../../../lib/chart-config';

interface CurvePoint {
  item_number: number;
  game_type: string;
  m: number | null;
  n: number | null;
  divergence_mean: number | null;
  divergence_se: number | null;
  alignment_mean: number | null;
  alignment_se: number | null;
  parsimony_mean: number | null;
  parsimony_se: number | null;
}

interface Props {
  data: CurvePoint[];
}

export function LearningCurveAll({ data }: Props) {
  // Build labels showing item info
  const labels = data.map(d => {
    const config = d.m && d.n ? `(${d.m},${d.n})` : '';
    return `${d.game_type.toUpperCase()} ${config}`;
  });

  // Find the gap between item 4 and item 8 (evaluative block)
  const evalGapIndex = data.findIndex(d => d.item_number >= 8);

  const makeDataset = (metric: string, color: string) => {
    const meanKey = `${metric}_mean` as keyof CurvePoint;
    const seKey = `${metric}_se` as keyof CurvePoint;

    const means = data.map(d => d[meanKey] as number | null);
    const upper = data.map(d => {
      const m = d[meanKey] as number | null;
      const se = d[seKey] as number | null;
      return m != null && se != null ? m + se : null;
    });
    const lower = data.map(d => {
      const m = d[meanKey] as number | null;
      const se = d[seKey] as number | null;
      return m != null && se != null ? m - se : null;
    });

    return [
      {
        label: metric.charAt(0).toUpperCase() + metric.slice(1),
        data: means,
        borderColor: color,
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: color,
        tension: 0.3,
        spanGaps: true,
      },
      {
        label: `${metric} +SE`,
        data: upper,
        borderColor: 'transparent',
        backgroundColor: color + '18',
        borderWidth: 0,
        pointRadius: 0,
        fill: '+1',
        spanGaps: true,
      },
      {
        label: `${metric} -SE`,
        data: lower,
        borderColor: 'transparent',
        backgroundColor: 'transparent',
        borderWidth: 0,
        pointRadius: 0,
        spanGaps: true,
      },
    ];
  };

  const datasets = [
    ...makeDataset('divergence', METRIC_COLORS.divergence),
    ...makeDataset('alignment', METRIC_COLORS.alignment),
    ...makeDataset('parsimony', METRIC_COLORS.parsimony),
  ];

  const options = {
    ...baseChartOptions('Learning Across the Battery'),
    plugins: {
      ...baseChartOptions('Learning Across the Battery').plugins,
      legend: {
        display: true,
        labels: {
          color: CHART_COLORS.faded,
          font: { family: "'Fira Code', monospace", size: 11 },
          filter: (item: any) => !item.text.includes('SE'),
        },
      },
      annotation: evalGapIndex > 0 ? {
        annotations: {
          evalBlock: {
            type: 'line' as const,
            xMin: evalGapIndex - 0.5,
            xMax: evalGapIndex - 0.5,
            borderColor: CHART_COLORS.faded,
            borderWidth: 1,
            borderDash: [6, 4],
            label: {
              display: true,
              content: 'After peer evaluation',
              position: 'start' as const,
              color: CHART_COLORS.faded,
              font: { family: "'Fira Code', monospace", size: 9 },
            },
          },
        },
      } : undefined,
    },
    scales: {
      x: {
        ticks: {
          color: CHART_COLORS.faded,
          font: { family: "'Fira Code', monospace", size: 9 },
          maxRotation: 45,
        },
        grid: { color: CHART_COLORS.grid },
      },
      y: {
        title: {
          display: true,
          text: 'Mean Score',
          color: CHART_COLORS.faded,
          font: { family: "'Fira Code', monospace", size: 10 },
        },
        ticks: { color: CHART_COLORS.faded, font: { family: "'Fira Code', monospace", size: 10 } },
        grid: { color: CHART_COLORS.grid },
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
      }}>Learning Across the Battery</div>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--faded)', marginBottom: '1rem' }}>
        Mean ± SE for each metric across generative items (full completers only)
      </p>
      <div style={{ height: '350px' }}>
        <Line data={{ labels, datasets }} options={options as any} />
      </div>
    </div>
  );
}
