/**
 * Parsimony Leave-One-Out Play Screen (Item 6)
 *
 * Shows a set of words and asks participant to identify which word
 * could be removed without losing much connection to the targets.
 */

import React, { useState, useRef } from 'react';
import { useStudy } from '../../../lib/study-state';
import { api } from '../../../lib/api';
import { Panel } from '../../ui/Panel';
import { Button } from '../../ui/Button';

export function ParsimonyLOOPlay() {
  const { state, dispatch } = useStudy();
  const item = state.currentItem!;
  const config = item.config;
  const stimulus = item.stimulus?.stimulus_set || config.stimulus_set || {};
  const words: string[] = stimulus.words || [];

  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const startTimeRef = useRef(Date.now());

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);

    const timeMs = Date.now() - startTimeRef.current;
    try {
      const result = await api.studies.submitEvaluation(
        state.slug,
        config.item_number,
        { selected_word: selected },
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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xs)', justifyContent: 'center', marginBottom: 'var(--space-md)' }}>
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
        marginBottom: 'var(--space-lg)',
        lineHeight: 1.6,
      }}>
        These words were meant to connect to the targets above. Which one could be removed without losing much?
      </p>

      {/* Word choices */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 'var(--space-sm)',
        maxWidth: '500px',
        margin: '0 auto',
      }}>
        {words.map((word) => {
          const isSelected = selected === word;
          return (
            <button
              key={word}
              onClick={() => !submitting && setSelected(isSelected ? null : word)}
              disabled={submitting}
              style={{
                padding: 'var(--space-sm) var(--space-md)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.9rem',
                color: isSelected ? 'var(--bg-dark)' : 'var(--text-light)',
                background: isSelected ? 'var(--gold)' : 'rgba(255,255,255,0.03)',
                border: isSelected ? '2px solid var(--gold)' : '1px solid var(--faded-light)',
                cursor: submitting ? 'default' : 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {word}
            </button>
          );
        })}
      </div>

      <div style={{ textAlign: 'center', marginTop: 'var(--space-lg)' }}>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={!selected || submitting}
        >
          {submitting ? 'Submitting...' : selected ? `Remove "${selected}"` : 'Select a word'}
        </Button>
      </div>
    </div>
  );
}
