/**
 * Peer Rating Play Screen (Item 7)
 *
 * Shows 2 response sets (from other participants or cold-start)
 * and asks participant to rate each on 3 dimensions (1-5 scale).
 */

import React, { useState, useRef } from 'react';
import { useStudy } from '../../../lib/study-state';
import { api } from '../../../lib/api';
import { Panel } from '../../ui/Panel';
import { Button } from '../../ui/Button';

interface DimensionRating {
  key: string;
  value: number | null;
}

export function PeerRatingPlay() {
  const { state, dispatch } = useStudy();
  const item = state.currentItem!;
  const config = item.config;
  const stimulus = item.stimulus || item.config || {};
  const dimensions = config.dimensions || [];

  // stimulus.responses is an array of {index, words, game_id?, is_preconstructed}
  const responses: Array<{ index: number; words: string[]; game_id?: string; is_preconstructed?: boolean }> =
    stimulus.responses || [];

  // ratings[responseIndex][dimensionKey] = 1-5
  const [ratings, setRatings] = useState<Record<number, Record<string, number>>>({});
  const [submitting, setSubmitting] = useState(false);
  const startTimeRef = useRef(Date.now());

  const setRating = (responseIdx: number, dimKey: string, value: number) => {
    setRatings(prev => ({
      ...prev,
      [responseIdx]: {
        ...(prev[responseIdx] || {}),
        [dimKey]: value,
      },
    }));
  };

  const allRated = responses.every((_, ri) =>
    dimensions.every(d => ratings[ri]?.[d.key] != null)
  );

  const handleSubmit = async () => {
    if (!allRated) return;
    setSubmitting(true);

    const timeMs = Date.now() - startTimeRef.current;
    try {
      const result = await api.studies.submitEvaluation(
        state.slug,
        config.item_number,
        { ratings },
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

      {/* Response sets to rate */}
      {responses.map((resp, ri) => (
        <Panel key={ri} style={{ marginBottom: 'var(--space-lg)' }}>
          <div style={{ marginBottom: 'var(--space-md)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--faded)', textTransform: 'uppercase' }}>
              Response {ri + 1}
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xs)', marginTop: 'var(--space-xs)' }}>
              {resp.words.map((w) => (
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

          {/* Rating dimensions */}
          {dimensions.map((dim) => {
            const currentValue = ratings[ri]?.[dim.key] ?? null;
            return (
              <div key={dim.key} style={{ marginBottom: 'var(--space-md)' }}>
                <p style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.8rem',
                  color: 'var(--text-light)',
                  marginBottom: 'var(--space-xs)',
                }}>
                  {dim.prompt}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--faded)', minWidth: '80px', textAlign: 'right' }}>
                    {dim.low}
                  </span>
                  <div style={{ display: 'flex', gap: '4px', flex: 1, justifyContent: 'center' }}>
                    {[1, 2, 3, 4, 5].map((v) => (
                      <button
                        key={v}
                        onClick={() => !submitting && setRating(ri, dim.key, v)}
                        disabled={submitting}
                        style={{
                          width: '36px',
                          height: '36px',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.85rem',
                          fontWeight: currentValue === v ? 600 : 400,
                          color: currentValue === v ? 'var(--bg-dark)' : 'var(--text-light)',
                          background: currentValue === v ? 'var(--gold)' : 'rgba(255,255,255,0.03)',
                          border: currentValue === v ? '2px solid var(--gold)' : '1px solid var(--faded-light)',
                          cursor: submitting ? 'default' : 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--faded)', minWidth: '80px' }}>
                    {dim.high}
                  </span>
                </div>
              </div>
            );
          })}
        </Panel>
      ))}

      <div style={{ textAlign: 'center', marginTop: 'var(--space-md)' }}>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={!allRated || submitting}
        >
          {submitting ? 'Submitting...' : 'Submit Ratings'}
        </Button>
      </div>
    </div>
  );
}
