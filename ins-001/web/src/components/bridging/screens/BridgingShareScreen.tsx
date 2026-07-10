/**
 * Bridging score screen - INS-001.2
 *
 * Step 3: show the divergence score, then reveal how Claude Haiku finds the same
 * common ground and advance to results. (The multiplayer share option was removed.)
 */

import React, { useState } from 'react';
import { useBridgingSenderState } from '../../../lib/bridging-state';
import { api } from '../../../lib/api';
import { Panel } from '../../ui/Panel';
import { Button } from '../../ui/Button';
import { ProgressBar } from '../../ui/ProgressBar';

interface BridgingShareScreenProps {
  gameId: string;
  anchor: string;
  target: string;
  steps: string[];
  divergence: number;
  shareCode?: string;
}

function getDivergenceInterpretation(score: number): { label: string; description: string } {
  if (score < 30) {
    return { label: 'Predictable', description: 'Your concepts stay close to the direct path between anchor and target.' };
  } else if (score < 50) {
    return { label: 'Moderate', description: 'Your concepts take a moderately creative route.' };
  } else if (score < 70) {
    return { label: 'Creative', description: 'Your concepts arc away from the obvious path.' };
  } else {
    return { label: 'Highly Creative', description: 'Your concepts take a highly unexpected route to connect the ideas.' };
  }
}

export const BridgingShareScreen: React.FC<BridgingShareScreenProps> = ({
  gameId,
  anchor,
  target,
  steps,
  divergence,
}) => {
  const { dispatch } = useBridgingSenderState();
  const [isGettingHaiku, setIsGettingHaiku] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const interpretation = getDivergenceInterpretation(divergence);

  const handleReveal = async () => {
    setIsGettingHaiku(true);
    setError(null);
    try {
      await api.bridging.triggerHaikuBridge(gameId);
      const game = await api.bridging.get(gameId);
      dispatch({ type: 'GAME_COMPLETED', game });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get Haiku union');
    } finally {
      setIsGettingHaiku(false);
    }
  };

  return (
    <div>
      <ProgressBar currentStep={3} />

      <p className="subtitle">
        <span className="id">INS-001.2</span> · Step 3 of 3
      </p>
      <h1 className="title">Common ground submitted.</h1>

      <Panel title="Your Common Ground" meta={Math.round(divergence).toString()} style={{ marginBottom: 'var(--space-lg)' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-md)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: 'var(--gold)', marginBottom: 'var(--space-sm)' }}>
            {anchor} ←――――――――――――――――→ {target}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-light)' }}>
            {steps.join(' · ')}
          </div>
        </div>

        <div style={{ marginBottom: 'var(--space-md)' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: '4px', height: '8px', overflow: 'hidden', marginBottom: 'var(--space-xs)' }}>
            <div style={{ background: 'var(--gold)', height: '100%', width: `${Math.min(100, divergence)}%`, transition: 'width 0.3s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--faded)' }}>
            <span>predictable</span>
            <span>creative</span>
          </div>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-light)' }}>
          <strong style={{ color: 'var(--gold)' }}>{interpretation.label}</strong>
          <br />
          <span style={{ color: 'var(--faded)' }}>{interpretation.description}</span>
        </div>
      </Panel>

      {error && (
        <div style={{ color: 'var(--alert)', marginBottom: 'var(--space-md)', fontSize: 'var(--text-sm)' }}>
          ◈ {error}
        </div>
      )}

      <div className="btn-group">
        <Button variant="primary" onClick={handleReveal} disabled={isGettingHaiku}>
          {isGettingHaiku ? 'Finding…' : 'See how Haiku finds it →'}
        </Button>
      </div>
    </div>
  );
};
