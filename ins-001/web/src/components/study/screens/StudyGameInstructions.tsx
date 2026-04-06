/**
 * Study Game Instructions Screen (v3)
 *
 * Shows item type, targets, and worked example. No timer info.
 * Uses "Item X of Y" instead of "Game X of Y".
 */

import React from 'react';
import { useStudy } from '../../../lib/study-state';
import { Panel } from '../../ui/Panel';
import { Button } from '../../ui/Button';
import { ProgressBar } from '../../ui/ProgressBar';

export function StudyGameInstructions() {
  const { state, dispatch } = useStudy();
  const item = state.currentItem!;
  const config = item.config;

  const taskLabel = config.task === 'dat' ? 'Divergent Association'
    : config.task === 'rat' ? 'Remote Associates'
    : 'Semantic Bridge';

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
          {taskLabel}
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

        {/* Show targets for Bridge and RAT */}
        {config.targets.length > 0 && (
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

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--faded)' }}>
          <span>Words to enter: <strong style={{ color: 'var(--text-light)' }}>{config.n}</strong></span>
        </div>
      </Panel>

      {/* Worked example for first Bridge game */}
      {item.worked_example && config.show_worked_example && (
        <Panel title="Example" style={{ marginTop: 'var(--space-md)' }}>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.8rem',
            color: 'var(--faded)',
            marginBottom: 'var(--space-sm)',
            lineHeight: 1.6,
          }}>
            In this game, you'll see target words and enter association words that connect
            to them. Here's an example — your goal is to find words that relate to as many
            targets as possible.
          </p>

          <div style={{ marginBottom: 'var(--space-sm)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--faded)', textTransform: 'uppercase' }}>
              Targets:{' '}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--gold)' }}>
              {item.worked_example.targets.join(', ')}
            </span>
          </div>

          <div style={{ marginBottom: 'var(--space-sm)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--faded)', textTransform: 'uppercase' }}>
              Example associations:{' '}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-light)' }}>
              {item.worked_example.associations.join(', ')}
            </span>
          </div>

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--faded)', lineHeight: 2 }}>
            {item.worked_example.explanations.map((exp, i) => (
              <div key={i}>
                <strong style={{ color: 'var(--text-light)' }}>{exp.word}</strong>: {exp.connections}
              </div>
            ))}
          </div>
        </Panel>
      )}

      <div className="btn-group" style={{ textAlign: 'center', marginTop: 'var(--space-lg)' }}>
        <Button variant="primary" onClick={() => dispatch({ type: 'GAME_STARTED' })}>
          Start
        </Button>
      </div>
    </div>
  );
}
