/**
 * Cohort Distributions — 3 full-width histograms showing aggregate percentile
 * distributions for divergence, alignment, and parsimony across all participants.
 * Optionally overlays the authenticated user's percentile as a gold marker.
 */

import React from 'react';
import { Bar } from 'react-chartjs-2';
import { METRIC_COLORS, CHART_COLORS, baseChartOptions } from '../../../lib/chart-config';

interface MetricDist {
  values: number[];
  mean: number;
  median: number;
  sd: number;
}

interface Props {
  distributions: {
    divergence?: MetricDist;
    alignment?: MetricDist;
    parsimony?: MetricDist;
  };
  participantCount: number;
  userPercentiles?: Record<string, number>;
}

function buildHistogram(values: number[], bins = 20): number[] {
  const counts = new Array(bins).fill(0);
  for (const v of values) {
    const idx = Math.min(Math.floor(v / (100 / bins)), bins - 1);
    counts[idx]++;
  }
  return counts;
}

function DistributionChart({ label, dist, color, userPct }: { label: string; dist: MetricDist; color: string; userPct?: number }) {
  const bins = 20;
  const counts = buildHistogram(dist.values, bins);
  const labels = Array.from({ length: bins }, (_, i) => `${i * 5}`);

  // Custom plugin to draw user percentile line directly on canvas
  const userLinePlugin = userPct != null ? {
    id: `userLine-${label}`,
    afterDraw: (chart: any) => {
      const { ctx, chartArea, scales } = chart;
      if (!chartArea || !scales?.x) return;
      // userPct is 0-100, bins are 0-19 mapped to labels "0","5",...,"95"
      // Find the x pixel for the user's percentile bin
      const binIndex = Math.min(Math.floor(userPct! / 5), bins - 1);
      // Interpolate within the bin for sub-bin precision
      const fraction = (userPct! % 5) / 5;
      const binPixel = scales.x.getPixelForValue(binIndex);
      const nextBinPixel = binIndex < bins - 1
        ? scales.x.getPixelForValue(binIndex + 1)
        : binPixel + (binPixel - scales.x.getPixelForValue(binIndex - 1));
      const xPixel = binPixel + fraction * (nextBinPixel - binPixel);

      ctx.save();
      ctx.strokeStyle = CHART_COLORS.gold;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(xPixel, chartArea.top);
      ctx.lineTo(xPixel, chartArea.bottom);
      ctx.stroke();
      // Draw small diamond marker at top
      ctx.setLineDash([]);
      ctx.fillStyle = CHART_COLORS.gold;
      ctx.beginPath();
      const dy = 5;
      ctx.moveTo(xPixel, chartArea.top - dy);
      ctx.lineTo(xPixel + dy, chartArea.top);
      ctx.lineTo(xPixel, chartArea.top + dy);
      ctx.lineTo(xPixel - dy, chartArea.top);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    },
  } : null;

  const data = {
    labels,
    datasets: [{
      data: counts,
      backgroundColor: color + '66',
      borderColor: color,
      borderWidth: 1,
      barPercentage: 1.0,
      categoryPercentage: 1.0,
    }],
  };

  const options = {
    ...baseChartOptions(),
    plugins: {
      ...baseChartOptions().plugins,
      legend: { display: false },
      title: { display: false },
      tooltip: {
        ...baseChartOptions().plugins.tooltip,
        callbacks: {
          title: (ctx: any) => `Percentile ${ctx[0].label}–${parseInt(ctx[0].label) + 5}`,
          label: (ctx: any) => `${ctx.raw} participants`,
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: CHART_COLORS.faded,
          font: { family: "'Fira Code', monospace", size: 9 },
          maxTicksLimit: 5,
        },
        grid: { display: false },
        title: {
          display: true,
          text: 'Aggregate Percentile',
          color: CHART_COLORS.faded,
          font: { family: "'Fira Code', monospace", size: 9 },
        },
      },
      y: {
        ticks: {
          color: CHART_COLORS.faded,
          font: { family: "'Fira Code', monospace", size: 9 },
        },
        grid: { color: CHART_COLORS.grid },
        title: { display: false },
      },
    },
  };

  const plugins = userLinePlugin ? [userLinePlugin] : [];

  return (
    <div style={{ marginBottom: '2rem', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
        <span style={{
          fontFamily: "var(--font-serif)",
          fontSize: '1.25rem',
          color: 'var(--text-light)',
          fontWeight: 300,
        }}>{label}</span>
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: '0.75rem',
          color: 'var(--faded)',
        }}>
          mean: {dist.mean.toFixed(1)}&nbsp;&nbsp;&nbsp;&nbsp;median: {dist.median.toFixed(1)}
          {userPct != null && (
            <>&nbsp;&nbsp;&nbsp;&nbsp;<span style={{ color: CHART_COLORS.gold }}>you: {userPct.toFixed(0)}th</span></>
          )}
        </span>
      </div>
      <div style={{ height: '100px' }}>
        <Bar data={data} options={options as any} plugins={plugins} />
      </div>
    </div>
  );
}

export function CohortDistributions({ distributions, participantCount, userPercentiles }: Props) {
  if (participantCount < 5) {
    const metrics = [
      { key: 'divergence' as const, label: 'Divergence', color: METRIC_COLORS.divergence },
      { key: 'alignment' as const, label: 'Alignment', color: METRIC_COLORS.alignment },
      { key: 'parsimony' as const, label: 'Parsimony', color: METRIC_COLORS.parsimony },
    ];
    return (
      <div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.65rem',
          textTransform: 'uppercase' as const,
          letterSpacing: '2px',
          color: 'var(--gold)',
          marginBottom: '1rem',
        }}>Cohort Distributions</div>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', color: 'var(--faded)', marginBottom: '1.5rem' }}>
          Distribution histograms will appear with 5+ participants. Current summary:
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          {metrics.map(({ key, label, color }) => {
            const dist = distributions[key];
            if (!dist) return null;
            return (
              <div key={key} style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--faded-light)',
                padding: '1rem',
              }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', textTransform: 'uppercase' as const, letterSpacing: '1px', color, marginBottom: '0.5rem' }}>{label}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--faded)' }}>
                  Mean: {dist.mean.toFixed(1)} · SD: {dist.sd.toFixed(1)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.65rem',
        textTransform: 'uppercase' as const,
        letterSpacing: '2px',
        color: 'var(--gold)',
        marginBottom: '1.5rem',
      }}>Cohort Distributions</div>
      {distributions.divergence && (
        <DistributionChart label="Divergence" dist={distributions.divergence} color={METRIC_COLORS.divergence} userPct={userPercentiles?.divergence} />
      )}
      {distributions.alignment && (
        <DistributionChart label="Alignment" dist={distributions.alignment} color={METRIC_COLORS.alignment} userPct={userPercentiles?.alignment} />
      )}
      {distributions.parsimony && (
        <DistributionChart label="Parsimony" dist={distributions.parsimony} color={METRIC_COLORS.parsimony} userPct={userPercentiles?.parsimony} />
      )}
    </div>
  );
}
