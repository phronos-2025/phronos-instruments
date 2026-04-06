/**
 * Optional Break Screen
 *
 * After the core battery (items 1-7), gives the participant the choice
 * to continue with bonus items or view partial results.
 */

import React, { useState } from 'react';
import { useStudy } from '../../../lib/study-state';
import { api } from '../../../lib/api';
import { Panel } from '../../ui/Panel';
import { Button } from '../../ui/Button';

export function OptionalBreakScreen() {
  const { state, dispatch } = useStudy();
  const [submitting, setSubmitting] = useState(false);

  const coreComplete = state.itemsCompleted;
  const totalItems = state.totalItems;
  const remaining = totalItems - coreComplete;

  const handleChoice = async (partial: boolean) => {
    setSubmitting(true);
    try {
      await api.studies.optPartial(state.slug, partial);
      dispatch({ type: 'BREAK_CHOICE', partial });
    } catch (e: any) {
      setSubmitting(false);
      dispatch({ type: 'ERROR', message: e.message || 'Failed to record choice' });
    }
  };

  return (
    <div className="study-container">
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-lg)' }}>
        <h2 className="title" style={{ fontSize: '1.6rem' }}>
          Nice work!
        </h2>
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: '0.9rem',
          color: 'var(--faded)',
          marginTop: 'var(--space-sm)',
          lineHeight: 1.6,
        }}>
          You've completed the core section ({coreComplete} items).
        </p>
      </div>

      <Panel>
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: '0.9rem',
          color: 'var(--text-light)',
          lineHeight: 1.6,
          marginBottom: 'var(--space-md)',
        }}>
          There {remaining === 1 ? 'is' : 'are'} {remaining} optional bonus item{remaining !== 1 ? 's' : ''} remaining.
          These additional items help us collect more data and give you a richer profile.
        </p>
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: '0.85rem',
          color: 'var(--faded)',
          lineHeight: 1.6,
        }}>
          You can stop here and view your results, or continue with the bonus items.
          Either way, your responses so far are saved.
        </p>
      </Panel>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-sm)',
        maxWidth: '400px',
        margin: 'var(--space-lg) auto 0',
        textAlign: 'center',
      }}>
        <Button
          variant="primary"
          onClick={() => handleChoice(false)}
          disabled={submitting}
        >
          Continue with bonus items
        </Button>
        <Button
          variant="secondary"
          onClick={() => handleChoice(true)}
          disabled={submitting}
        >
          View my results
        </Button>
      </div>
    </div>
  );
}
