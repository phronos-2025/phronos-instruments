/**
 * Alignment Ranking Play Screen (Item 5)
 *
 * Shows 3 response sets and asks participant to rank them best → worst
 * based on how well they connect to the target words.
 */

import React, { useState, useRef } from 'react';
import { useStudy } from '../../../lib/study-state';
import { api } from '../../../lib/api';
import { Panel } from '../../ui/Panel';
import { Button } from '../../ui/Button';

export function AlignmentRankingPlay() {
  const { state, dispatch } = useStudy();
  const item = state.currentItem!;
  const config = item.config;
  const stimulus = item.stimulus?.stimulus_sets || config.stimulus_sets || {};

  const setKeys = Object.keys(stimulus);
  const [ranking, setRanking] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const startTimeRef = useRef(Date.now());

  const toggleRank = (key: string) => {
    setRanking(prev => {
      if (prev.includes(key)) {
        return prev.filter(k => k !== key);
      }
      if (prev.length >= setKeys.length) return prev;
      return [...prev, key];
    });
  };

  const getRankLabel = (key: string) => {
    const idx = ranking.indexOf(key);
    if (idx === -1) return null;
    if (idx === 0) return '1st (best)';
    if (idx === 1) return '2nd';
    return '3rd (worst)';
  };

  const handleSubmit = async () => {
    if (ranking.length !== setKeys.length) return;
    setSubmitting(true);

    const timeMs = Date.now() - startTimeRef.current;
    try {
      const result = await api.studies.submitEvaluation(
        state.slug,
        config.item_number,
        { ranking },
        timeMs,
      );
      dispatch({ type: 'EVALUATION_SCORED', result });
    } catch (e: any) {
      setSubmitting(false);
      dispatch({ type: 'ERROR', message: e.message || 'Submission failed' });
    }
  };

  return (
    <div className="study-container">
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-md)' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--faded)', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Item {config.item_number} of {state.totalItems}
        </p>
      </div>

      {/* Targets */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xs)', justifyContent: 'center', marginBottom: 'var(--space-lg)' }}>
        {config.targets.map((t) => (
          <span key={t} style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.9rem',
            color: 'var(--gold)',
            background: 'var(--gold-dim)',
            padding: '4px 12px',
            border: '1px solid var(--gold)',
          }}>
            {t}
          </span>
        ))}
      </div>

      <p style={{
        fontFamily: 'var(--font-body)',
        fontSize: '0.85rem',
        color: 'var(--faded)',
        textAlign: 'center',
        marginBottom: 'var(--space-md)',
      }}>
        Click each set in order from best to worst connection to the targets.
      </p>

      {/* Response sets */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', maxWidth: '500px', margin: '0 auto' }}>
        {setKeys.map((key) => {
          const set = stimulus[key];
          const words = set.words || set;
          const label = set.label || key;
          const rankLabel = getRankLabel(key);
          const isRanked = ranking.includes(key);

          return (
            <div
              key={key}
              onClick={() => !submitting && toggleRank(key)}
              style={{
                padding: 'var(--space-md)',
                border: isRanked ? '2px solid var(--gold)' : '1px solid var(--faded-light)',
                background: isRanked ? 'rgba(255,215,0,0.05)' : 'rgba(255,255,255,0.02)',
                cursor: submitting ? 'default' : 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xs)' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--faded)', textTransform: 'uppercase' }}>
                  {label}
                </span>
                {rankLabel && (
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.7rem',
                    color: 'var(--gold)',
                    fontWeight: 600,
                  }}>
                    {rankLabel}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xs)' }}>
                {(Array.isArray(words) ? words : []).map((w: string) => (
                  <span key={w} style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.85rem',
                    color: 'var(--text-light)',
                    padding: '2px 8px',
                    border: '1px solid var(--faded-light)',
                  }}>
                    {w}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ textAlign: 'center', marginTop: 'var(--space-lg)' }}>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={ranking.length !== setKeys.length || submitting}
        >
          {submitting ? 'Submitting...' : 'Submit Ranking'}
        </Button>
        {ranking.length > 0 && ranking.length < setKeys.length && (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--faded)', marginTop: 'var(--space-sm)' }}>
            Click to select the remaining set{setKeys.length - ranking.length > 1 ? 's' : ''}
          </p>
        )}
      </div>
    </div>
  );
}
