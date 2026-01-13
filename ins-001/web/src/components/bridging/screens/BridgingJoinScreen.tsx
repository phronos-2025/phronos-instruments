/**
 * Bridging Join Screen - INS-001.2
 *
 * Recipient views clues and enters their guess for anchor-target pair.
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
  clues?: string[];
}

export const BridgingJoinScreen: React.FC<BridgingJoinScreenProps> = ({
  shareCode,
  gameId: initialGameId,
  clues: initialClues,
}) => {
  const { dispatch } = useBridgingRecipientState();
  const [gameId, setGameId] = useState(initialGameId || '');
  const [clues, setClues] = useState<string[]>(initialClues || []);
  const [guessedAnchor, setGuessedAnchor] = useState('');
  const [guessedTarget, setGuessedTarget] = useState('');
  const [isLoading, setIsLoading] = useState(!initialGameId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Join game on mount
  useEffect(() => {
    if (initialGameId && initialClues) {
      // Already loaded
      dispatch({
        type: 'GAME_LOADED',
        gameId: initialGameId,
        clues: initialClues,
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

        // Join via share code
        const response = await api.bridging.join(shareCode);
        setGameId(response.game_id);
        setClues(response.clues);
        setIsLoading(false);

        dispatch({
          type: 'GAME_LOADED',
          gameId: response.game_id,
          clues: response.clues,
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
  }, [shareCode, initialGameId, initialClues, dispatch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!guessedAnchor.trim() || !guessedTarget.trim()) {
      setError('Please enter both anchor and target guesses');
      return;
    }

    const anchorClean = guessedAnchor.trim().toLowerCase();
    const targetClean = guessedTarget.trim().toLowerCase();

    if (anchorClean === targetClean) {
      setError('Anchor and target must be different words');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await api.bridging.submitGuess(gameId, {
        guessed_anchor: anchorClean,
        guessed_target: targetClean,
      });

      dispatch({
        type: 'GUESS_SUBMITTED',
        guessedAnchor: response.guessed_anchor,
        guessedTarget: response.guessed_target,
        trueAnchor: response.true_anchor,
        trueTarget: response.true_target,
        reconstructionScore: response.reconstruction_score,
        anchorSimilarity: response.anchor_similarity,
        targetSimilarity: response.target_similarity,
        orderSwapped: response.order_swapped,
        exactAnchorMatch: response.exact_anchor_match,
        exactTargetMatch: response.exact_target_match,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit guess');
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

  return (
    <div>
      <p className="subtitle">
        <span className="id">INS-001.2</span> · Reconstruction
      </p>
      <h1 className="title">Reconstruct the bridge.</h1>

      <p className="description">
        Someone built a bridge between two concepts. These clues connect them:
      </p>

      {/* Clues display */}
      <Panel style={{ marginBottom: 'var(--space-lg)', textAlign: 'center' }}>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '1rem',
            color: 'var(--gold)',
            lineHeight: '2',
          }}
        >
          {clues.map((clue, i) => (
            <span key={i}>
              {clue}
              {i < clues.length - 1 && (
                <span style={{ color: 'var(--faded)' }}> · </span>
              )}
            </span>
          ))}
        </div>
      </Panel>

      <p className="description">What two words were being connected?</p>

      <form onSubmit={handleSubmit}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 'var(--space-lg)',
            marginBottom: 'var(--space-lg)',
          }}
        >
          {/* Anchor guess */}
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Anchor</label>
            <input
              type="text"
              className="text-input"
              value={guessedAnchor}
              onChange={(e) => setGuessedAnchor(e.target.value)}
              placeholder="your guess"
              autoComplete="off"
              spellCheck="false"
              autoFocus
              disabled={isSubmitting}
            />
          </div>

          {/* Target guess */}
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Target</label>
            <input
              type="text"
              className="text-input"
              value={guessedTarget}
              onChange={(e) => setGuessedTarget(e.target.value)}
              placeholder="your guess"
              autoComplete="off"
              spellCheck="false"
              disabled={isSubmitting}
            />
          </div>
        </div>

        {error && (
          <div
            style={{
              color: 'var(--alert)',
              marginBottom: 'var(--space-md)',
              fontSize: 'var(--text-sm)',
            }}
          >
            ◈ {error}
          </div>
        )}

        <div className="btn-group" style={{ justifyContent: 'center' }}>
          <Button
            type="submit"
            variant="primary"
            disabled={
              !guessedAnchor.trim() || !guessedTarget.trim() || isSubmitting
            }
          >
            {isSubmitting ? 'Submitting...' : 'Submit Guess →'}
          </Button>
        </div>
      </form>
    </div>
  );
};
