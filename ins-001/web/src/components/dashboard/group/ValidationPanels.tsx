/**
 * Validation Panels — Three side-by-side cards showing alignment ranking,
 * parsimony LOO, and peer rating correlation results.
 */

import React from 'react';
import { CHART_COLORS, METRIC_COLORS } from '../../../lib/chart-config';

interface Props {
  validation: {
    alignment_ranking?: {
      counts: Record<string, number>;
      total: number;
      p_value: number | null;
    };
    parsimony_loo?: {
      counts: Record<string, number>;
      correct_word: string;
      total: number;
      p_value: number | null;
    };
    peer_correlations?: {
      diff_div_r: number | null;
      conn_ali_r: number | null;
      uniq_par_r: number | null;
      n: number;
    };
  };
}

const cardStyle: React.CSSProperties = {
  background: 'var(--card-bg)',
  border: '1px solid var(--faded-light)',
  padding: '1.25rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
};

const cardTitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '0.65rem',
  textTransform: 'uppercase',
  letterSpacing: '1.5px',
  color: 'var(--text-light)',
};

const subtitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: '0.8rem',
  color: 'var(--faded)',
  fontStyle: 'italic',
};

function BarRow({ label, count, total, highlight }: { label: string; count: number; total: number; highlight?: boolean }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.7rem',
        color: highlight ? 'var(--gold)' : 'var(--faded)',
        width: '60px',
        flexShrink: 0,
      }}>{label}</span>
      <div style={{ flex: 1, height: '16px', background: 'var(--faded-ultra)', borderRadius: '1px', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: highlight ? METRIC_COLORS.divergence + '88' : 'var(--faded-light)',
          transition: 'width 0.3s ease',
        }} />
      </div>
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.7rem',
        color: highlight ? 'var(--text-light)' : 'var(--faded)',
        width: '35px',
        textAlign: 'right',
        flexShrink: 0,
      }}>{Math.round(pct)}%</span>
    </div>
  );
}

function formatP(p: number | null): string {
  if (p === null) return '';
  if (p < 0.001) return 'p < .001';
  if (p < 0.01) return `p < .01`;
  if (p < 0.05) return `p = ${p.toFixed(3)}`;
  return `p = ${p.toFixed(2)} (n.s.)`;
}

export function ValidationPanels({ validation }: Props) {
  return (
    <div>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.65rem',
        textTransform: 'uppercase' as const,
        letterSpacing: '2px',
        color: 'var(--gold)',
        marginBottom: '1.5rem',
      }}>Validation</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        {/* Alignment Ranking */}
        <div style={cardStyle}>
          <div style={cardTitleStyle}>Alignment Ranking</div>
          <div style={subtitleStyle}>"Which set best connects?"</div>
          {validation.alignment_ranking ? (
            <>
              {Object.entries(validation.alignment_ranking.counts)
                .sort(([, a], [, b]) => b - a)
                .map(([key, count]) => (
                  <BarRow
                    key={key}
                    label={`Set ${key}`}
                    count={count}
                    total={validation.alignment_ranking!.total}
                    highlight={count === Math.max(...Object.values(validation.alignment_ranking!.counts))}
                  />
                ))}
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--faded)', marginTop: '0.25rem' }}>
                N = {validation.alignment_ranking.total} · {formatP(validation.alignment_ranking.p_value)}
              </div>
            </>
          ) : (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--faded)' }}>
              Insufficient data
            </div>
          )}
        </div>

        {/* Parsimony LOO */}
        <div style={cardStyle}>
          <div style={cardTitleStyle}>Parsimony LOO</div>
          <div style={subtitleStyle}>"Which word is redundant?"</div>
          {validation.parsimony_loo ? (
            <>
              {Object.entries(validation.parsimony_loo.counts)
                .sort(([, a], [, b]) => b - a)
                .map(([word, count]) => (
                  <BarRow
                    key={word}
                    label={word}
                    count={count}
                    total={validation.parsimony_loo!.total}
                    highlight={word === validation.parsimony_loo!.correct_word}
                  />
                ))}
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--faded)', marginTop: '0.25rem' }}>
                N = {validation.parsimony_loo.total} · {formatP(validation.parsimony_loo.p_value)}
              </div>
            </>
          ) : (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--faded)' }}>
              Insufficient data
            </div>
          )}
        </div>

        {/* Peer Rating Correlations */}
        <div style={cardStyle}>
          <div style={cardTitleStyle}>Peer Ratings</div>
          <div style={subtitleStyle}>Correlation between ratings and scores</div>
          {validation.peer_correlations ? (
            <>
              {[
                { label: 'Diff~Div', value: validation.peer_correlations.diff_div_r },
                { label: 'Conn~Ali', value: validation.peer_correlations.conn_ali_r },
                { label: 'Uniq~Par', value: validation.peer_correlations.uniq_par_r },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--faded)' }}>{label}</span>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.85rem',
                    color: value != null ? 'var(--text-light)' : 'var(--faded)',
                  }}>
                    {value != null ? `r = ${value.toFixed(2)}` : '—'}
                  </span>
                </div>
              ))}
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--faded)', marginTop: '0.25rem' }}>
                N = {validation.peer_correlations.n} rating pairs
              </div>
            </>
          ) : (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--faded)' }}>
              Insufficient data
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
