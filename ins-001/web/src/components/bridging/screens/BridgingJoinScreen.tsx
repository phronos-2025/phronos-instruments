/**
 * Bridging Join Screen - INS-001.2 V2
 *
 * Recipient sees anchor + target and builds their own union (concepts).
 * Their union is then compared to the sender's union.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useBridgingRecipientState } from '../../../lib/bridging-state';
import { api } from '../../../lib/api';
import type { ClueTiming } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';
import { Panel } from '../../ui/Panel';
import { Button } from '../../ui/Button';

interface ConceptTiming {
  firstEnteredMs: number | null;
  lastModifiedMs: number | null;
}

interface BridgingJoinScreenProps {
  shareCode: string;
  gameId?: string;
  anchor?: string;
  target?: string;
  senderStepCount?: number;
}

export const BridgingJoinScreen: React.FC<BridgingJoinScreenProps> = ({
  shareCode,
  gameId: initialGameId,
  anchor: initialAnchor,
  target: initialTarget,
  senderStepCount: initialStepCount,
}) => {
  const { dispatch } = useBridgingRecipientState();
  const [gameId, setGameId] = useState(initialGameId || '');
  const [anchor, setAnchor] = useState(initialAnchor || '');
  const [target, setTarget] = useState(initialTarget || '');
  const [senderStepCount, setSenderStepCount] = useState(initialStepCount || 0);

  // Step inputs (1 required, up to 5)
  const [steps, setSteps] = useState<string[]>(['', '', '', '', '']);

  const [isLoading, setIsLoading] = useState(!initialGameId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Timing tracking
  const screenLoadTime = useRef<number>(Date.now());
  const [timings, setTimings] = useState<ConceptTiming[]>([
    { firstEnteredMs: null, lastModifiedMs: null },
    { firstEnteredMs: null, lastModifiedMs: null },
    { firstEnteredMs: null, lastModifiedMs: null },
    { firstEnteredMs: null, lastModifiedMs: null },
    { firstEnteredMs: null, lastModifiedMs: null },
  ]);

  // Join game on mount using V2 endpoint
  useEffect(() => {
    if (initialGameId && initialAnchor && initialTarget) {
      dispatch({
        type: 'GAME_LOADED_V2',
        gameId: initialGameId,
        anchor: initialAnchor,
        target: initialTarget,
        senderStepCount: initialStepCount || 0,
      });
      return;
    }

    const joinGame = async () => {
      try {
        // Ensure authenticated
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          await supabase.auth.signInAnonymously();
        }

        // Join via share code (V2 endpoint)
        const response = await api.bridging.joinV2(shareCode);
        setGameId(response.game_id);
        setAnchor(response.anchor_word);
        setTarget(response.target_word);
        setSenderStepCount(response.sender_clue_count);
        setIsLoading(false);

        dispatch({
          type: 'GAME_LOADED_V2',
          gameId: response.game_id,
          anchor: response.anchor_word,
          target: response.target_word,
          senderStepCount: response.sender_clue_count,
        });
      } catch (err) {
        setIsLoading(false);
        const message =
          err instanceof Error ? err.message : 'Failed to join game';
        setError(message);
        dispatch({
          type: 'ERROR',
          message,
        });
      }
    };

    joinGame();
  }, [shareCode, initialGameId, initialAnchor, initialTarget, initialStepCount, dispatch]);

  const updateStep = (index: number, value: string) => {
    const newSteps = [...steps];
    newSteps[index] = value;
    setSteps(newSteps);

    // Update timing
    const now = Date.now() - screenLoadTime.current;
    setTimings(prev => {
      const newTimings = [...prev];
      if (value.trim() && newTimings[index].firstEnteredMs === null) {
        // First character typed
        newTimings[index] = { firstEnteredMs: now, lastModifiedMs: now };
      } else if (value.trim()) {
        // Subsequent modifications
        newTimings[index] = { ...newTimings[index], lastModifiedMs: now };
      }
      return newTimings;
    });
  };

  // Get non-empty steps
  const getFilledSteps = () => steps.filter((c) => c.trim().length > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const filledSteps = getFilledSteps();

    if (filledSteps.length === 0) {
      setError('Please enter at least one concept');
      return;
    }

    // Validate steps don't include anchor or target
    const anchorLower = anchor.toLowerCase();
    const targetLower = target.toLowerCase();
    for (const step of filledSteps) {
      const stepLower = step.trim().toLowerCase();
      if (stepLower === anchorLower || stepLower === targetLower) {
        setError('Concepts cannot be the anchor or target words');
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Build timing data for filled steps
      const filledIndices = steps
        .map((_, i) => i)
        .filter(i => steps[i].trim().length > 0);

      const clueTimings: ClueTiming[] = filledIndices.map(i => ({
        word: steps[i].trim().toLowerCase(),
        first_entered_ms: timings[i].firstEnteredMs ?? 0,
        last_modified_ms: timings[i].lastModifiedMs ?? 0,
      }));

      const response = await api.bridging.submitBridge(gameId, {
        clues: filledSteps.map((c) => c.trim().toLowerCase()),
        clue_timings: clueTimings,
      });

      dispatch({
        type: 'BRIDGE_SUBMITTED',
        // Sender (Them)
        senderSteps: response.sender_clues,
        senderRelevance: response.sender_relevance,
        senderDivergence: response.sender_divergence,
        // Recipient (You)
        recipientSteps: response.recipient_clues,
        recipientRelevance: response.recipient_relevance,
        recipientDivergence: response.recipient_divergence,
        // Bridge comparison
        bridgeSimilarity: response.bridge_similarity,
        centroidSimilarity: response.centroid_similarity,
        pathAlignment: response.path_alignment,
        // Haiku baseline
        haikuClues: response.haiku_clues,
        haikuRelevance: response.haiku_relevance,
        haikuDivergence: response.haiku_divergence,
        // Statistical baseline
        lexicalBridge: response.lexical_bridge,
        lexicalRelevance: response.lexical_relevance,
        lexicalDivergence: response.lexical_divergence,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit union');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <p className="subtitle">
          <span className="id">INS-001.2</span> · Loading
        </p>
        <h1 className="title">Joining game...</h1>
        <div
          style={{
            color: 'var(--faded)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
          }}
        >
          Preparing...
        </div>
      </div>
    );
  }

  if (error && !gameId) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <p className="subtitle">
          <span className="id">INS-001.2</span> · Error
        </p>
        <h1 className="title">Could not join game.</h1>
        <p
          style={{
            color: 'var(--alert)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
            marginBottom: 'var(--space-lg)',
          }}
        >
          {error}
        </p>
        <a
          href="/ins-001/ins-001-2/"
          style={{
            color: 'var(--gold)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          Find your own common ground →
        </a>
      </div>
    );
  }

  const filledCount = getFilledSteps().length;

  return (
    <div>
      <p className="subtitle">
        <span className="id">INS-001.2</span> · Find Common Ground
      </p>
      <h1 className="title">Connect these concepts.</h1>

      <p className="description">
        Someone found common ground between these two words. Now find your own.
      </p>

      {/* Anchor ←→ Target display */}
      <Panel style={{ marginBottom: 'var(--space-lg)', textAlign: 'center' }}>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '1.25rem',
            color: 'var(--gold)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--space-md)',
          }}
        >
          <span style={{ fontWeight: 600 }}>{anchor}</span>
          <span
            style={{
              color: 'var(--faded)',
              fontSize: '0.9rem',
              letterSpacing: '0.1em',
            }}
          >
            ←――――――――――→
          </span>
          <span style={{ fontWeight: 600 }}>{target}</span>
        </div>
        {senderStepCount > 0 && (
          <div
            style={{
              marginTop: 'var(--space-sm)',
              color: 'var(--faded)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
            }}
          >
            Their common ground used {senderStepCount} concept{senderStepCount !== 1 ? 's' : ''}
          </div>
        )}
      </Panel>

      <p className="description">
        Enter 1-5 concepts that connect <strong>{anchor}</strong> to{' '}
        <strong>{target}</strong>:
      </p>

      <form onSubmit={handleSubmit}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-sm)',
            marginBottom: 'var(--space-lg)',
          }}
        >
          {steps.map((step, index) => (
            <div key={index} className="input-group" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                <span
                  style={{
                    color: index === 0 ? 'var(--gold)' : 'var(--faded)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    width: '1.5rem',
                    textAlign: 'right',
                  }}
                >
                  {index + 1}.
                </span>
                <input
                  type="text"
                  className="text-input"
                  value={step}
                  onChange={(e) => updateStep(index, e.target.value)}
                  placeholder={index === 0 ? 'first concept (required)' : 'optional concept'}
                  autoComplete="off"
                  spellCheck="false"
                  autoFocus={index === 0}
                  disabled={isSubmitting}
                  style={{ flex: 1 }}
                />
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            textAlign: 'center',
            marginBottom: 'var(--space-md)',
            color: 'var(--faded)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
          }}
        >
          {filledCount === 0
            ? 'Enter at least one concept'
            : `${filledCount} concept${filledCount !== 1 ? 's' : ''} entered`}
        </div>

        {error && (
          <div
            style={{
              color: 'var(--alert)',
              marginBottom: 'var(--space-md)',
              fontSize: 'var(--text-sm)',
              textAlign: 'center',
            }}
          >
            ◈ {error}
          </div>
        )}

        <div className="btn-group" style={{ justifyContent: 'center' }}>
          <Button
            type="submit"
            variant="primary"
            disabled={filledCount === 0 || isSubmitting}
          >
            {isSubmitting ? 'Comparing...' : 'Compare'}
          </Button>
        </div>
      </form>
    </div>
  );
};
