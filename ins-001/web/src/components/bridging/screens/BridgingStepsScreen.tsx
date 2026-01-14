/**
 * Bridging Steps Screen - INS-001.2
 *
 * Step 2: Enter 1-5 steps connecting anchor and target.
 */

import React, { useState } from 'react';
import { useBridgingSenderState } from '../../../lib/bridging-state';
import { api } from '../../../lib/api';
import { Button } from '../../ui/Button';
import { ProgressBar } from '../../ui/ProgressBar';

interface BridgingStepsScreenProps {
  gameId: string;
  anchor: string;
  target: string;
}

export const BridgingStepsScreen: React.FC<BridgingStepsScreenProps> = ({
  gameId,
  anchor,
  target,
}) => {
  const { dispatch } = useBridgingSenderState();
  const [steps, setSteps] = useState<string[]>(['', '', '', '', '']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateStep = (index: number, value: string) => {
    const newSteps = [...steps];
    newSteps[index] = value;
    setSteps(newSteps);
  };

  const getFilledSteps = () => {
    return steps.filter((c) => c.trim()).map((c) => c.trim().toLowerCase());
  };

  const validateSteps = (): string | null => {
    const filled = getFilledSteps();

    if (filled.length === 0) {
      return 'Please provide at least one step';
    }

    // Check for anchor/target in steps
    for (const step of filled) {
      if (step === anchor.toLowerCase() || step === target.toLowerCase()) {
        return `Step "${step}" cannot be the anchor or target word`;
      }
    }

    // Check for duplicates
    const unique = new Set(filled);
    if (unique.size !== filled.length) {
      return 'Steps must be unique';
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateSteps();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // API still uses 'clues' field name for now
      const response = await api.bridging.submitClues(gameId, {
        clues: getFilledSteps(),
      });

      // If Haiku game and completed, go to results
      // V2 uses haiku_clues, V1 legacy uses haiku_guessed_anchor
      if (response.status === 'completed' && (response.haiku_clues || response.haiku_guessed_anchor)) {
        const game = await api.bridging.get(gameId);
        dispatch({
          type: 'GAME_COMPLETED',
          game,
        });
      } else {
        // Human recipient - go to share screen
        dispatch({
          type: 'STEPS_SUBMITTED',
          gameId,
          steps: response.clues,
          divergence: response.divergence_score,
          shareCode: response.share_code,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit steps');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filledCount = getFilledSteps().length;

  return (
    <div>
      <ProgressBar currentStep={2} />

      <p className="subtitle">
        <span className="id">INS-001.2</span> · Step 2 of 3
      </p>
      <h1 className="title">Build your bridge.</h1>

      <p className="description">
        Enter single-word steps that connect your anchor and target.
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
            Your Steps{' '}
            <span style={{ color: 'var(--faded)', fontWeight: 'normal' }}>
              {filledCount}/5 words
            </span>
          </label>

          {steps.map((step, index) => (
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
                value={step}
                onChange={(e) => updateStep(index, e.target.value)}
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
            At least 1 step required. More steps provide more signal.
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
            {isSubmitting ? 'Submitting...' : 'Submit Bridge →'}
          </Button>
        </div>
      </form>
    </div>
  );
};
