/**
 * Evaluative Feedback Screen
 *
 * Shows computed feedback after evaluative item submission.
 */

import React from 'react';
import { useStudy } from '../../../lib/study-state';
import { Panel } from '../../ui/Panel';
import { Button } from '../../ui/Button';

export function EvaluativeFeedback() {
  const { state, dispatch } = useStudy();
  const evaluation = state.currentEvaluation!;
  const item = state.currentItem!;
  const config = item.config;

  const isCorrect = evaluation.correct;
  const showCorrectness = isCorrect !== undefined && isCorrect !== null && evaluation.task !== 'peer_rating';

  return (
    <div className="study-container">
      <div style={{ textAlign: 'center', marginBottom: 'var(--space-lg)' }}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--faded)', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Item {config.item_number} of {state.totalItems}
        </p>
        <h2 className="title" style={{ fontSize: '1.6rem', marginTop: 'var(--space-xs)' }}>
          Feedback
        </h2>
      </div>

      {/* Correct/incorrect indicator */}
      {showCorrectness && (
        <div style={{
          textAlign: 'center',
          marginBottom: 'var(--space-md)',
          padding: 'var(--space-sm)',
          border: `1px solid ${isCorrect ? 'var(--active)' : '#CC5544'}`,
          background: isCorrect ? 'rgba(68, 170, 119, 0.1)' : 'rgba(204, 85, 68, 0.1)',
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
            color: isCorrect ? 'var(--active)' : '#CC5544',
          }}>
            {isCorrect ? 'Correct!' : 'Not quite'}
          </span>
        </div>
      )}

      {/* Feedback details */}
      <Panel>
        {evaluation.feedback && typeof evaluation.feedback === 'object' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {/* Alignment ranking feedback */}
            {evaluation.feedback.correct_order && (
              <div>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--faded)', textTransform: 'uppercase', marginBottom: 'var(--space-xs)' }}>
                  Computed ranking
                </p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-light)' }}>
                  {(evaluation.feedback.correct_order as string[]).join(' > ')}
                </p>
              </div>
            )}

            {/* Parsimony LOO feedback */}
            {evaluation.feedback.expected_word && (
              <div>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--faded)', textTransform: 'uppercase', marginBottom: 'var(--space-xs)' }}>
                  Most redundant word
                </p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--gold)' }}>
                  {evaluation.feedback.expected_word as string}
                </p>
                {evaluation.feedback.explanation && (
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--faded)', marginTop: 'var(--space-xs)', lineHeight: 1.5 }}>
                    {evaluation.feedback.explanation as string}
                  </p>
                )}
              </div>
            )}

            {/* Peer rating feedback — just a thank-you */}
            {evaluation.task === 'peer_rating' && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-light)', lineHeight: 1.6 }}>
                Thanks for your ratings! Your evaluations help us understand how people
                perceive creative word associations.
              </p>
            )}

            {/* Generic message fallback */}
            {evaluation.feedback.message && (
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-light)', lineHeight: 1.6 }}>
                {evaluation.feedback.message as string}
              </p>
            )}
          </div>
        )}
      </Panel>

      <div className="btn-group" style={{ textAlign: 'center', marginTop: 'var(--space-lg)' }}>
        <Button variant="primary" onClick={() => dispatch({ type: 'NEXT_ITEM' })}>
          Continue
        </Button>
      </div>
    </div>
  );
}
