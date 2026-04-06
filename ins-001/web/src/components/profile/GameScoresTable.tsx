/**
 * Per-Game Scores Table
 *
 * Shows each game with its configuration and the user's scores/percentiles.
 */

import React from 'react';

interface GameScore {
  game_number: number;
  game_type: string;
  m: number;
  n: number;
  scores: Record<string, number | boolean>;
  percentiles?: Record<string, number>;
}

interface Props {
  games: GameScore[];
  showPercentiles: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  dat: 'DAT',
  rat: 'RAT',
  bridge: 'Bridge',
};

export function GameScoresTable({ games, showPercentiles }: Props) {
  if (games.length === 0) return null;

  const formatScore = (metric: string, value: unknown): string => {
    if (typeof value !== 'number') return '—';
    if (metric === 'divergence') return value.toFixed(1);
    return (value * 100).toFixed(0) + '%';
  };

  const formatPercentile = (value: number | undefined): string => {
    if (value === undefined || value === null) return '—';
    return Math.round(value) + 'th';
  };

  return (
    <div>
      <p style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.65rem',
        color: 'var(--faded)',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        marginBottom: 'var(--space-sm)',
      }}>
        Per-Game Scores
      </p>

      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.7rem',
        }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--faded-light)' }}>
              <th style={{ ...thStyle, textAlign: 'left' }}>Game</th>
              <th style={{ ...thStyle, textAlign: 'left' }}>Type</th>
              <th style={thStyle}>Div</th>
              <th style={thStyle}>Ali</th>
              <th style={thStyle}>Par</th>
              {showPercentiles && <th style={thStyle}>Div %</th>}
              {showPercentiles && <th style={thStyle}>Ali %</th>}
              {showPercentiles && <th style={thStyle}>Par %</th>}
            </tr>
          </thead>
          <tbody>
            {games.map((g) => (
              <tr key={g.game_number} style={{ borderBottom: '1px solid var(--faded-ultra)' }}>
                <td style={tdStyle}>{g.game_number}</td>
                <td style={{ ...tdStyle, color: 'var(--gold)' }}>
                  {TYPE_LABELS[g.game_type] || g.game_type} ({g.m},{g.n})
                </td>
                <td style={tdStyle}>{formatScore('divergence', g.scores.divergence)}</td>
                <td style={tdStyle}>{formatScore('alignment', g.scores.alignment)}</td>
                <td style={tdStyle}>{formatScore('parsimony', g.scores.parsimony)}</td>
                {showPercentiles && (
                  <td style={tdStyle}>{formatPercentile(g.percentiles?.divergence)}</td>
                )}
                {showPercentiles && (
                  <td style={tdStyle}>{formatPercentile(g.percentiles?.alignment)}</td>
                )}
                {showPercentiles && (
                  <td style={tdStyle}>{formatPercentile(g.percentiles?.parsimony)}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '6px 8px',
  color: 'var(--faded)',
  fontWeight: 'normal',
  fontSize: '0.6rem',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  textAlign: 'center',
};

const tdStyle: React.CSSProperties = {
  padding: '8px',
  color: 'var(--text-light)',
  textAlign: 'center',
};
