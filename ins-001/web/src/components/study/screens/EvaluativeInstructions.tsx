/**
 * Evaluative Instructions Screen
 *
 * Shows instructions for evaluative items (alignment ranking, parsimony LOO, peer rating).
 * No timer info since evaluative items are untimed.
 */

import React from 'react';
import { useStudy } from '../../../lib/study-state';
import { Panel } from '../../ui/Panel';
import { Button } from '../../ui/Button';
import { ProgressBar } from '../../ui/ProgressBar';

const TASK_LABELS: Record<string, string> = {
  alignment_ranking: 'Alignment Ranking',
  parsimony_loo: 'Parsimony Check',
  peer_rating: 'Peer Rating',
};

export function EvaluativeInstructions() {
  const { state, dispatch } = useStudy();
  const item = state.currentItem!;
  const config = item.config;

  return (
    <div className="study-container">
      <ProgressBar
        currentStep={config.item_number}
        totalSteps={state.totalItems}
      />

      <div style={{ textAlign: 'center', marginBottom: 'var(--space-lg)' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--faded)', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Item {config.item_number} of {state.totalItems}
        </p>
        <h2 className="title" style={{ fontSize: '1.6rem', marginTop: 'var(--space-xs)' }}>
          {TASK_LABELS[config.task] || config.task}
        </h2>
      </div>

      <Panel>
        <p style={{
          fontFamily: 'var(--font-body)',
          fontSize: '0.9rem',
          color: 'var(--text-light)',
          lineHeight: 1.6,
          marginBottom: 'var(--space-md)',
        }}>
          {config.instructions}
        </p>

        {/* Show targets if present */}
        {config.targets && config.targets.length > 0 && (
          <div style={{ marginBottom: 'var(--space-md)' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--faded)', textTransform: 'uppercase', marginBottom: 'var(--space-xs)' }}>
              Target words
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xs)' }}>
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
          </div>
        )}

        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--faded)' }}>
          Take your time — there is no time limit.
        </p>
      </Panel>

      <div className="btn-group" style={{ textAlign: 'center', marginTop: 'var(--space-lg)' }}>
        <Button variant="primary" onClick={() => dispatch({ type: 'EVALUATIVE_STARTED' })}>
          Start
        </Button>
      </div>
    </div>
  );
}
