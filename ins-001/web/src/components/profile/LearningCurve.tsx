/**
 * Learning Curve Chart
 *
 * Line chart showing game-by-game percentile scores for each metric.
 */

import React from 'react';
import { Line } from 'react-chartjs-2';
import { CHART_COLORS, METRIC_COLORS, baseChartOptions } from '../../lib/chart-config';

interface CurvePoint {
  item_number: number;
  game_type: string;
  divergence_percentile: number | null;
  alignment_percentile: number | null;
  parsimony_percentile: number | null;
}

interface Props {
  data: CurvePoint[];
}

export function LearningCurve({ data }: Props) {
  const labels = data.map(d => `G${d.item_number}`);

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Divergence',
        data: data.map(d => d.divergence_percentile),
        borderColor: METRIC_COLORS.divergence,
        backgroundColor: 'rgba(201, 160, 99, 0.1)',
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: METRIC_COLORS.divergence,
        tension: 0.3,
        spanGaps: true,
      },
      {
        label: 'Alignment',
        data: data.map(d => d.alignment_percentile),
        borderColor: METRIC_COLORS.alignment,
        backgroundColor: 'rgba(68, 170, 119, 0.1)',
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: METRIC_COLORS.alignment,
        tension: 0.3,
        spanGaps: true,
      },
      {
        label: 'Parsimony',
        data: data.map(d => d.parsimony_percentile),
        borderColor: METRIC_COLORS.parsimony,
        backgroundColor: 'rgba(107, 143, 212, 0.1)',
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: METRIC_COLORS.parsimony,
        tension: 0.3,
        spanGaps: true,
      },
    ],
  };

  const options = {
    ...baseChartOptions('Learning Curve'),
    scales: {
      x: {
        ticks: { color: CHART_COLORS.faded, font: { family: "'Fira Code', monospace", size: 9 } },
        grid: { color: CHART_COLORS.grid },
      },
      y: {
        min: 0,
        max: 100,
        title: {
          display: true,
          text: 'Percentile',
          color: CHART_COLORS.faded,
          font: { family: "'Fira Code', monospace", size: 10 },
        },
        ticks: { color: CHART_COLORS.faded, font: { family: "'Fira Code', monospace", size: 9 } },
        grid: { color: CHART_COLORS.grid },
      },
    },
  };

  return (
    <div style={{ height: '250px' }}>
      <Line data={chartData} options={options as any} />
    </div>
  );
}
