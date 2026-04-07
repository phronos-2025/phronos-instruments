/**
 * Study Score Reveal Screen (v3)
 *
 * Shows computed metrics with percentile (if available),
 * first-encounter explanations, and paired-item comparisons.
 */

import React from 'react';
import { useStudy } from '../../../lib/study-state';
import { Panel } from '../../ui/Panel';
import { Button } from '../../ui/Button';

// Normative data from Bowden & Jung-Beeman (2003)
// Each entry: [time_sec, cumulative_percent_solved]
const RAT_NORMS: Record<string, Array<[number, number]>> = {
  'print,berry,bird': [[2, 10], [7, 38], [15, 49], [30, 77]],
  'water,mine,shaker': [[2, 12], [7, 28], [15, 41], [30, 85]],
};

function getRatNormKey(item: any): string | null {
  const targets = item?.config?.targets;
  if (!targets || !Array.isArray(targets)) return null;
  return targets.map((t: string) => t.toLowerCase()).join(',');
}

function getRatNormComparison(normKey: string, timeMs: number): { bracket: string; pctSolved: number } | null {
  const norms = RAT_NORMS[normKey];
  if (!norms) return null;
  const timeSec = timeMs / 1000;
  // Find which bracket the user falls into
  for (let i = norms.length - 1; i >= 0; i--) {
    if (timeSec <= norms[i][0]) {
      continue;
    }
    // User took longer than this bracket
    if (i === norms.length - 1) {
      return { bracket: `>${norms[i][0]}s`, pctSolved: norms[i][1] };
    }
  }
  // User was within the first bracket
  if (timeSec <= norms[0][0]) {
    return { bracket: `\u2264${norms[0][0]}s`, pctSolved: norms[0][1] };
  }
  // Find exact bracket
  for (let i = 0; i < norms.length; i++) {
    if (timeSec <= norms[i][0]) {
      return { bracket: `\u2264${norms[i][0]}s`, pctSolved: norms[i][1] };
    }
  }
  return { bracket: `>${norms[norms.length - 1][0]}s`, pctSolved: norms[norms.length - 1][1] };
}

const METRIC_INFO: Record<string, { label: string; explanation: string }> = {
  divergence: {
    label: 'Divergence',
    explanation: 'How spread out your words are from each other in meaning.',
  },
  divergence_glove: {
    label: 'Divergence (GloVe)',
    explanation: 'Spread measured using a different embedding model.',
  },
  alignment_display: {
    label: 'Alignment',
    explanation: 'How well your words connect to the target words compared to random words.',
  },
  parsimony: {
    label: 'Parsimony',
    explanation: 'Whether each of your words pulled its weight — no redundancy.',
  },
};

export function StudyScoreReveal() {
  const { state, dispatch } = useStudy();
  const score = state.currentScore!;
  const isRat = score.game_type === 'rat';

  const metricsToShow = Object.keys(score.scores).filter(
    (key) => key !== 'exact_match' && key !== 'recovery_mrr'
      && key !== 'alignment' && key !== 'alignment_z'
      && (isRat ? key !== 'alignment_display' : true)
      && typeof score.scores[key] === 'number'
  );

  // RAT normative timing comparison
  const ratNormKey = isRat ? getRatNormKey(state.currentItem) : null;
  const ratNorm = (ratNormKey && score.time_to_complete_ms)
    ? getRatNormComparison(ratNormKey, score.time_to_complete_ms)
    : null;

  const isLastItem = state.itemsCompleted >= state.totalItems;
  const comparison = score.comparison;

  const handleNext = () => {
    metricsToShow.forEach(metric => {
      if (!state.metricsExplained.has(metric)) {
        dispatch({ type: 'METRIC_EXPLAINED', metric });
      }
    });
    dispatch({ type: 'NEXT_ITEM' });
  };

  const formatScore = (metric: string, value: number): string => {
    if (metric === 'divergence' || metric === 'divergence_glove') return value.toFixed(1);
    if (metric === 'alignment_display') return Math.round(value) + '%';
    if (metric === 'parsimony') return (value * 100).toFixed(0) + '%';
    return value.toFixed(2);
  };

  const formatDelta = (metric: string, delta: number): string => {
    const sign = delta > 0 ? '+' : '';
    if (metric === 'divergence' || metric === 'divergence_glove') return sign + delta.toFixed(1);
    if (metric === 'alignment_display') return sign + Math.round(delta) + '%';
    return sign + (delta * 100).toFixed(0) + '%';
  };

  return (
    <div className="study-container">
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-lg)' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--faded)', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Item {score.item_number || score.game_number} of {state.totalItems}
        </p>
        <h2 className="title" style={{ fontSize: '1.6rem', marginTop: 'var(--space-xs)' }}>
          Your Scores
        </h2>
      </div>

      {/* RAT correct/incorrect callout */}
      {isRat && score.exact_match === true && (
        <div style={{
          textAlign: 'center',
          marginBottom: 'var(--space-md)',
          padding: 'var(--space-sm)',
          border: '1px solid var(--active)',
          background: 'rgba(68, 170, 119, 0.1)',
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--active)' }}>
            Correct!
          </span>
        </div>
      )}
      {isRat && score.exact_match === false && (
        <div style={{
          textAlign: 'center',
          marginBottom: 'var(--space-md)',
          padding: 'var(--space-sm)',
          border: '1px solid #CC5544',
          background: 'rgba(204, 85, 68, 0.1)',
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#CC5544' }}>
            Not quite
          </span>
          {state.currentItem?.config?.solution && (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-light)', marginTop: 'var(--space-xs)' }}>
              The answer was <strong style={{ color: 'var(--gold)' }}>{state.currentItem.config.solution}</strong>
            </p>
          )}
        </div>
      )}

      {/* RAT normative timing comparison */}
      {isRat && ratNorm && score.time_to_complete_ms && (
        <Panel style={{ maxWidth: '500px', margin: '0 auto var(--space-md)', textAlign: 'center' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--faded)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 'var(--space-xs)' }}>
            Your time
          </p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', color: 'var(--gold)', fontWeight: 600 }}>
            {(score.time_to_complete_ms / 1000).toFixed(1)}s
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-light)', marginTop: 'var(--space-xs)', lineHeight: 1.5 }}>
            In normative data (Bowden & Jung-Beeman, 2003), {ratNorm.pctSolved}% of participants
            solved this item within {ratNorm.bracket.replace('\u2264', '').replace('>', '')}.
          </p>
          {/* Full breakdown */}
          {ratNormKey && RAT_NORMS[ratNormKey] && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-md)', marginTop: 'var(--space-sm)', flexWrap: 'wrap' }}>
              {RAT_NORMS[ratNormKey].map(([sec, pct]) => {
                const userSec = score.time_to_complete_ms! / 1000;
                const isUserBracket = userSec <= sec && (RAT_NORMS[ratNormKey].findIndex(([s]) => s === sec) === 0 || userSec > RAT_NORMS[ratNormKey][RAT_NORMS[ratNormKey].findIndex(([s]) => s === sec) - 1][0]);
                return (
                  <div key={sec} style={{ textAlign: 'center' }}>
                    <p style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.7rem',
                      color: isUserBracket ? 'var(--gold)' : 'var(--faded)',
                      fontWeight: isUserBracket ? 600 : 400,
                    }}>
                      {pct}%
                    </p>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--faded)' }}>
                      {'\u2264'}{sec}s
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      )}

      {/* Score cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: metricsToShow.length <= 2 ? 'repeat(auto-fit, minmax(200px, 1fr))' : 'repeat(3, 1fr)',
        gap: 'var(--space-md)',
        maxWidth: '600px',
        margin: '0 auto',
      }}>
        {metricsToShow.map((metric) => {
          const info = METRIC_INFO[metric];
          if (!info) return null;

          const rawValue = score.scores[metric] as number;
          const percentile = score.percentiles?.[metric];
          const isFirstTime = !state.metricsExplained.has(metric);

          return (
            <Panel key={metric} style={{ textAlign: 'center' }}>
              <p style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.6rem',
                color: 'var(--faded)',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                marginBottom: 'var(--space-xs)',
              }}>
                {info.label}
              </p>

              <p style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '1.6rem',
                color: 'var(--gold)',
                fontWeight: 600,
              }}>
                {formatScore(metric, rawValue)}
              </p>

              {percentile !== undefined && percentile !== null && (
                <p style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.7rem',
                  color: 'var(--text-light)',
                  marginTop: '4px',
                }}>
                  {Math.round(percentile)}th percentile
                </p>
              )}

              {score.insufficient_data && (
                <p style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.6rem',
                  color: 'var(--faded)',
                  marginTop: '4px',
                }}>
                  Percentiles available after more participants
                </p>
              )}

              {isFirstTime && (
                <p style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.6rem',
                  color: 'var(--faded)',
                  marginTop: 'var(--space-sm)',
                  lineHeight: 1.5,
                  fontStyle: 'italic',
                  borderTop: '1px solid var(--faded-light)',
                  paddingTop: 'var(--space-xs)',
                }}>
                  {info.explanation}
                </p>
              )}
            </Panel>
          );
        })}
      </div>

      {/* Paired item comparison (items 9/10) */}
      {comparison && (
        <Panel title={`Compared to Item ${comparison.paired_item}`} style={{ maxWidth: '600px', margin: 'var(--space-lg) auto 0' }}>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.8rem',
            color: 'var(--faded)',
            marginBottom: 'var(--space-md)',
            lineHeight: 1.5,
          }}>
            This item used the same task type as Item {comparison.paired_item}. Here's how you changed:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {Object.entries(comparison.deltas).map(([metric, delta]) => {
              const info = METRIC_INFO[metric];
              if (!info) return null;
              const isPositive = delta > 0;
              const color = isPositive ? 'var(--active)' : '#CC5544';
              return (
                <div key={metric} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--faded)' }}>
                    {info.label}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color, fontWeight: 600 }}>
                    {formatDelta(metric, delta)} {isPositive ? '\u2191' : '\u2193'}
                  </span>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      <div className="btn-group" style={{ textAlign: 'center', marginTop: 'var(--space-lg)' }}>
        <Button variant="primary" onClick={handleNext}>
          {isLastItem ? 'Final Questions' : 'Continue'}
        </Button>
      </div>
    </div>
  );
}
