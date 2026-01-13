/**
 * Bridging Clues Screen - INS-001.2
 *
 * Step 2: Enter 1-5 clues connecting anchor and target.
 */

import React, { useState } from 'react';
import { useBridgingSenderState } from '../../../lib/bridging-state';
import { api } from '../../../lib/api';
import { Button } from '../../ui/Button';
import { ProgressBar } from '../../ui/ProgressBar';

interface BridgingCluesScreenProps {
  gameId: string;
  anchor: string;
  target: string;
}

export const BridgingCluesScreen: React.FC<BridgingCluesScreenProps> = ({
  gameId,
  anchor,
  target,
}) => {
  const { dispatch } = useBridgingSenderState();
  const [clues, setClues] = useState<string[]>(['', '', '', '', '']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateClue = (index: number, value: string) => {
    const newClues = [...clues];
    newClues[index] = value;
    setClues(newClues);
  };

  const getFilledClues = () => {
    return clues.filter((c) => c.trim()).map((c) => c.trim().toLowerCase());
  };

  const validateClues = (): string | null => {
    const filled = getFilledClues();

    if (filled.length === 0) {
      return 'Please provide at least one clue';
    }

    // Check for anchor/target in clues
    for (const clue of filled) {
      if (clue === anchor.toLowerCase() || clue === target.toLowerCase()) {
        return `Clue "${clue}" cannot be the anchor or target word`;
      }
    }

    // Check for duplicates
    const unique = new Set(filled);
    if (unique.size !== filled.length) {
      return 'Clues must be unique';
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateClues();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await api.bridging.submitClues(gameId, {
        clues: getFilledClues(),
      });

      // If Haiku game and completed, go to results
      if (response.status === 'completed' && response.haiku_guessed_anchor) {
        const game = await api.bridging.get(gameId);
        dispatch({
          type: 'GAME_COMPLETED',
          game,
        });
      } else {
        // Human recipient - go to share screen
        dispatch({
          type: 'CLUES_SUBMITTED',
          gameId,
          clues: response.clues,
          divergence: response.divergence_score,
          shareCode: response.share_code,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit clues');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filledCount = getFilledClues().length;

  return (
    <div>
      <ProgressBar currentStep={2} />

      <p className="subtitle">
        <span className="id">INS-001.2</span> · Step 2 of 3
      </p>
      <h1 className="title">Provide your clues.</h1>

      <p className="description">
        Enter single-word clues that connect your anchor and target.
      </p>

      {/* Bridge visualization */}
      <div
        style={{
          textAlign: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.9rem',
          color: 'var(--gold)',
          marginBottom: 'var(--space-lg)',
          padding: 'var(--space-md)',
          border: '1px solid var(--gold-dim)',
          borderRadius: '4px',
        }}
      >
        {anchor} ←――――――――――――――――→ {target}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label className="input-label">
            Your Clues{' '}
            <span style={{ color: 'var(--faded)', fontWeight: 'normal' }}>
              {filledCount}/5 words
            </span>
          </label>

          {clues.map((clue, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                marginBottom: 'var(--space-sm)',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  color: 'var(--faded)',
                  width: '20px',
                }}
              >
                {index + 1}
              </span>
              <input
                type="text"
                className="text-input"
                value={clue}
                onChange={(e) => updateClue(index, e.target.value)}
                placeholder={index === 0 ? 'morning' : ''}
                autoComplete="off"
                spellCheck="false"
                autoFocus={index === 0}
                disabled={isSubmitting}
                style={{ flex: 1, marginBottom: 0 }}
              />
              {index > 0 && (
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.65rem',
                    color: 'var(--faded)',
                    minWidth: '60px',
                  }}
                >
                  (optional)
                </span>
              )}
            </div>
          ))}

          <p className="input-hint">
            At least 1 clue required. More clues provide more signal.
          </p>
        </div>

        {error && (
          <div
            style={{
              color: 'var(--alert)',
              marginTop: '1rem',
              fontSize: 'var(--text-sm)',
            }}
          >
            ◈ {error}
          </div>
        )}

        <div className="btn-group">
          <Button
            variant="ghost"
            onClick={() => dispatch({ type: 'BACK' })}
            type="button"
          >
            ← Back
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={filledCount === 0 || isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Clues →'}
          </Button>
        </div>
      </form>
    </div>
  );
};
