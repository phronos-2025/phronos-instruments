/**
 * Chart.js configuration matching the Phronos dark design system.
 */

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export const CHART_COLORS = {
  gold: '#C9A063',
  goldDim: 'rgba(201, 160, 99, 0.2)',
  goldBright: 'rgba(201, 160, 99, 0.8)',
  text: '#F2F0E9',
  faded: 'rgba(242, 240, 233, 0.4)',
  grid: 'rgba(242, 240, 233, 0.06)',
  active: '#44AA77',
  alert: '#CC5544',
  peer: 'rgba(242, 240, 233, 0.15)',
  peerBorder: 'rgba(242, 240, 233, 0.25)',
};

export const METRIC_COLORS: Record<string, string> = {
  divergence: '#C9A063',
  alignment: '#44AA77',
  parsimony: '#6B8FD4',
};

export function baseChartOptions(title?: string) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: CHART_COLORS.faded,
          font: { family: "'Fira Code', monospace", size: 10 },
        },
      },
      title: title
        ? {
            display: true,
            text: title,
            color: CHART_COLORS.text,
            font: { family: "'Cormorant Garamond', serif", size: 16, weight: 300 as const },
          }
        : { display: false },
      tooltip: {
        titleFont: { family: "'Fira Code', monospace", size: 11 },
        bodyFont: { family: "'Fira Code', monospace", size: 10 },
        backgroundColor: '#1A1A1A',
        borderColor: CHART_COLORS.gold,
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        ticks: { color: CHART_COLORS.faded, font: { family: "'Fira Code', monospace", size: 10 } },
        grid: { color: CHART_COLORS.grid },
      },
      y: {
        ticks: { color: CHART_COLORS.faded, font: { family: "'Fira Code', monospace", size: 10 } },
        grid: { color: CHART_COLORS.grid },
      },
    },
  };
}
