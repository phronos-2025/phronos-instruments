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
            {evaluation.task === 'alignment_ranking' && (
              <div>
                {evaluation.feedback.correct_order ? (
                  <>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--faded)', textTransform: 'uppercase', marginBottom: 'var(--space-xs)' }}>
                      Computed ranking
                    </p>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-light)' }}>
                      {(evaluation.feedback.correct_order as string[]).join(' > ')}
                    </p>
                  </>
                ) : (
                  <>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--faded)', textTransform: 'uppercase', marginBottom: 'var(--space-xs)' }}>
                      Your ranking
                    </p>
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-light)' }}>
                      {(evaluation.feedback.participant_ranking as string[])?.join(' > ') || 'Submitted'}
                    </p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--faded)', marginTop: 'var(--space-xs)', lineHeight: 1.5 }}>
                      Thanks for your ranking! Computed alignment scores will be available once we have enough data to compare.
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Parsimony LOO feedback — show how choice compares to others */}
            {evaluation.task === 'parsimony_loo' && evaluation.feedback.choice_counts && (
              <div>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--faded)', textTransform: 'uppercase', marginBottom: 'var(--space-xs)' }}>
                  You chose: <span style={{ color: 'var(--gold)' }}>{evaluation.feedback.selected as string}</span>
                </p>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--faded)', marginBottom: 'var(--space-sm)', lineHeight: 1.5 }}>
                  Here's how others answered:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {Object.entries(evaluation.feedback.choice_counts as Record<string, number>)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .map(([word, count]) => {
                      const total = evaluation.feedback.total_responses as number || 1;
                      const pct = Math.round(((count as number) / total) * 100);
                      const isSelected = word === evaluation.feedback.selected;
                      return (
                        <div key={word} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                          <span style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.8rem',
                            width: '70px',
                            textAlign: 'right',
                            color: isSelected ? 'var(--gold)' : 'var(--text-light)',
                            fontWeight: isSelected ? 600 : 400,
                          }}>
                            {word}
                          </span>
                          <div style={{
                            flex: 1,
                            height: '16px',
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: '2px',
                            overflow: 'hidden',
                          }}>
                            <div style={{
                              width: `${pct}%`,
                              height: '100%',
                              background: isSelected ? 'var(--gold)' : 'rgba(255,255,255,0.15)',
                              borderRadius: '2px',
                              transition: 'width 0.4s ease',
                              minWidth: (count as number) > 0 ? '2px' : '0',
                            }} />
                          </div>
                          <span style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.7rem',
                            color: 'var(--faded)',
                            width: '36px',
                            textAlign: 'right',
                          }}>
                            {pct}%
                          </span>
                        </div>
                      );
                    })}
                </div>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--faded)', marginTop: 'var(--space-sm)' }}>
                  Based on {evaluation.feedback.total_responses as number} response{(evaluation.feedback.total_responses as number) !== 1 ? 's' : ''}
                </p>
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
