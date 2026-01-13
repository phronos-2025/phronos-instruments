/**
 * Bridging Join Screen - INS-001.2 V2
 *
 * Recipient sees anchor + target and builds their own bridge (clues).
 * Their bridge is then compared to the sender's bridge.
 */

import React, { useState, useEffect } from 'react';
import { useBridgingRecipientState } from '../../../lib/bridging-state';
import { api } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';
import { Panel } from '../../ui/Panel';
import { Button } from '../../ui/Button';

interface BridgingJoinScreenProps {
  shareCode: string;
  gameId?: string;
  anchor?: string;
  target?: string;
  senderClueCount?: number;
}

export const BridgingJoinScreen: React.FC<BridgingJoinScreenProps> = ({
  shareCode,
  gameId: initialGameId,
  anchor: initialAnchor,
  target: initialTarget,
  senderClueCount: initialClueCount,
}) => {
  const { dispatch } = useBridgingRecipientState();
  const [gameId, setGameId] = useState(initialGameId || '');
  const [anchor, setAnchor] = useState(initialAnchor || '');
  const [target, setTarget] = useState(initialTarget || '');
  const [senderClueCount, setSenderClueCount] = useState(initialClueCount || 0);

  // Clue inputs (1 required, up to 5)
  const [clues, setClues] = useState<string[]>(['', '', '', '', '']);

  const [isLoading, setIsLoading] = useState(!initialGameId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Join game on mount using V2 endpoint
  useEffect(() => {
    if (initialGameId && initialAnchor && initialTarget) {
      dispatch({
        type: 'GAME_LOADED_V2',
        gameId: initialGameId,
        anchor: initialAnchor,
        target: initialTarget,
        senderClueCount: initialClueCount || 0,
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
        setSenderClueCount(response.sender_clue_count);
        setIsLoading(false);

        dispatch({
          type: 'GAME_LOADED_V2',
          gameId: response.game_id,
          anchor: response.anchor_word,
          target: response.target_word,
          senderClueCount: response.sender_clue_count,
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
  }, [shareCode, initialGameId, initialAnchor, initialTarget, initialClueCount, dispatch]);

  const updateClue = (index: number, value: string) => {
    const newClues = [...clues];
    newClues[index] = value;
    setClues(newClues);
  };

  // Get non-empty clues
  const getFilledClues = () => clues.filter((c) => c.trim().length > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const filledClues = getFilledClues();

    if (filledClues.length === 0) {
      setError('Please enter at least one clue');
      return;
    }

    // Validate clues don't include anchor or target
    const anchorLower = anchor.toLowerCase();
    const targetLower = target.toLowerCase();
    for (const clue of filledClues) {
      const clueLower = clue.trim().toLowerCase();
      if (clueLower === anchorLower || clueLower === targetLower) {
        setError('Clues cannot be the anchor or target words');
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await api.bridging.submitBridge(gameId, {
        clues: filledClues.map((c) => c.trim().toLowerCase()),
      });

      dispatch({
        type: 'BRIDGE_SUBMITTED',
        senderClues: response.sender_clues,
        recipientClues: response.recipient_clues,
        bridgeSimilarity: response.bridge_similarity,
        centroidSimilarity: response.centroid_similarity,
        pathAlignment: response.path_alignment,
        senderDivergence: response.sender_divergence,
        recipientDivergence: response.recipient_divergence,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit bridge');
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
          Preparing the bridge...
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
          href="/ins-001-2"
          style={{
            color: 'var(--gold)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          Create your own bridge →
        </a>
      </div>
    );
  }

  const filledCount = getFilledClues().length;

  return (
    <div>
      <p className="subtitle">
        <span className="id">INS-001.2</span> · Build Your Bridge
      </p>
      <h1 className="title">Connect these concepts.</h1>

      <p className="description">
        Someone built a bridge between these two words. Now build your own.
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
        {senderClueCount > 0 && (
          <div
            style={{
              marginTop: 'var(--space-sm)',
              color: 'var(--faded)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
            }}
          >
            Their bridge used {senderClueCount} clue{senderClueCount !== 1 ? 's' : ''}
          </div>
        )}
      </Panel>

      <p className="description">
        Enter 1-5 clues that connect <strong>{anchor}</strong> to{' '}
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
          {clues.map((clue, index) => (
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
                  value={clue}
                  onChange={(e) => updateClue(index, e.target.value)}
                  placeholder={index === 0 ? 'first clue (required)' : 'optional clue'}
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
            ? 'Enter at least one clue'
            : `${filledCount} clue${filledCount !== 1 ? 's' : ''} entered`}
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
            {isSubmitting ? 'Comparing bridges...' : 'Compare Bridges →'}
          </Button>
        </div>
      </form>
    </div>
  );
};
