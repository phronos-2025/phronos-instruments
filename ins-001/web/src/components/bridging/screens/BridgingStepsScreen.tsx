/**
 * Bridging Concepts Screen - INS-001.2
 *
 * Step 2: Enter 1-5 concepts connecting anchor and target.
 * Real-time validation with visual feedback (green check / red X).
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useBridgingSenderState } from '../../../lib/bridging-state';
import { api } from '../../../lib/api';
import type { ClueTiming } from '../../../lib/api';
import { Button } from '../../ui/Button';
import { ProgressBar } from '../../ui/ProgressBar';

interface BridgingStepsScreenProps {
  gameId: string;
  anchor: string;
  target: string;
}

// Morphological variant detection (mirrors backend logic)
function getWordStem(word: string): string {
  word = word.toLowerCase();
  const suffixes = [
    'ically', 'ation', 'ness', 'ment', 'able', 'ible', 'tion',
    'sion', 'ally', 'ful', 'less', 'ing', 'ity', 'ous', 'ive',
    'est', 'ier', 'ies', 'ied', 'ly', 'ed', 'er', 'en', 'es', 's'
  ];
  for (const suffix of suffixes) {
    if (word.endsWith(suffix) && word.length > suffix.length + 2) {
      return word.slice(0, -suffix.length);
    }
  }
  return word;
}

function normalizeStem(word: string): string {
  // Normalize stem for Y→I transformations (mystery/mysteries/mysterious)
  const stem = getWordStem(word);
  if (stem.endsWith('y')) return stem.slice(0, -1);
  if (stem.endsWith('i')) return stem.slice(0, -1);
  return stem;
}

function stripCommonPrefixes(word: string): string {
  // Strip common morphological prefixes (un-, dis-, im-, etc.)
  word = word.toLowerCase();
  const prefixes = [
    'counter', 'under', 'over', 'anti', 'dis', 'mis', 'non',
    'pre', 'un', 'in', 'im', 're'
  ];
  for (const prefix of prefixes) {
    if (word.startsWith(prefix) && word.length > prefix.length + 3) {
      return word.slice(prefix.length);
    }
  }
  return word;
}

function isMorphologicalVariant(word1: string, word2: string): boolean {
  const w1 = word1.toLowerCase();
  const w2 = word2.toLowerCase();

  // Exact match
  if (w1 === w2) return true;

  // One is substring of the other (catches most plurals/verb forms)
  if (w1.startsWith(w2) || w2.startsWith(w1)) {
    if (Math.abs(w1.length - w2.length) <= 4) {
      return true;
    }
  }

  // Check prefix-based variants (certainty/uncertainty)
  const w1Stripped = stripCommonPrefixes(w1);
  const w2Stripped = stripCommonPrefixes(w2);
  if (w1Stripped === w2Stripped) return true;
  if (w1Stripped === w2 || w2Stripped === w1) return true;

  // Same normalized stem (handles y→i transformations like mystery/mysteries/mysterious)
  if (normalizeStem(w1) === normalizeStem(w2)) return true;

  // Also check normalized stems of prefix-stripped versions
  if (normalizeStem(w1Stripped) === normalizeStem(w2Stripped)) return true;

  return false;
}

type ValidationStatus = 'empty' | 'valid' | 'invalid';

interface ConceptValidation {
  status: ValidationStatus;
  error?: string;
}

interface ConceptTiming {
  firstEnteredMs: number | null;
  lastModifiedMs: number | null;
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

  // Timing tracking
  const screenLoadTime = useRef<number>(Date.now());
  const [timings, setTimings] = useState<ConceptTiming[]>([
    { firstEnteredMs: null, lastModifiedMs: null },
    { firstEnteredMs: null, lastModifiedMs: null },
    { firstEnteredMs: null, lastModifiedMs: null },
    { firstEnteredMs: null, lastModifiedMs: null },
    { firstEnteredMs: null, lastModifiedMs: null },
  ]);

  // Reset screen load time when component mounts
  useEffect(() => {
    screenLoadTime.current = Date.now();
  }, []);

  const updateStep = (index: number, value: string) => {
    const newSteps = [...steps];
    newSteps[index] = value;
    setSteps(newSteps);
    setError(null); // Clear error when user types

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

  // Validate each concept in real-time
  const validations = useMemo((): ConceptValidation[] => {
    const anchorLower = anchor.toLowerCase();
    const targetLower = target.toLowerCase();
    const filledSoFar: string[] = [];

    return steps.map((step) => {
      const trimmed = step.trim().toLowerCase();

      // Empty field - no validation needed
      if (!trimmed) {
        return { status: 'empty' as ValidationStatus };
      }

      // Check if it's a morphological variant of anchor
      if (isMorphologicalVariant(trimmed, anchorLower)) {
        return {
          status: 'invalid' as ValidationStatus,
          error: `Too similar to anchor "${anchor}"`,
        };
      }

      // Check if it's a morphological variant of target
      if (isMorphologicalVariant(trimmed, targetLower)) {
        return {
          status: 'invalid' as ValidationStatus,
          error: `Too similar to target "${target}"`,
        };
      }

      // Check for duplicates (compare against previously validated concepts)
      for (const prev of filledSoFar) {
        if (isMorphologicalVariant(trimmed, prev)) {
          return {
            status: 'invalid' as ValidationStatus,
            error: `Duplicate of "${prev}"`,
          };
        }
      }

      // Valid - add to filled list for duplicate checking
      filledSoFar.push(trimmed);
      return { status: 'valid' as ValidationStatus };
    });
  }, [steps, anchor, target]);

  // Count valid filled concepts
  const validFilledCount = validations.filter((v) => v.status === 'valid').length;
  const hasInvalidConcepts = validations.some((v) => v.status === 'invalid');
  const canSubmit = validFilledCount > 0 && !hasInvalidConcepts && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Get only valid filled concepts
      const validIndices = steps
        .map((_, i) => i)
        .filter(i => validations[i].status === 'valid');

      const validConcepts = validIndices.map(i => steps[i].trim().toLowerCase());

      // Build timing data for valid concepts
      const clueTimings: ClueTiming[] = validIndices
        .map(i => ({
          word: steps[i].trim().toLowerCase(),
          first_entered_ms: timings[i].firstEnteredMs ?? 0,
          last_modified_ms: timings[i].lastModifiedMs ?? 0,
        }));

      const response = await api.bridging.submitClues(gameId, {
        clues: validConcepts,
        clue_timings: clueTimings,
      });

      // If Haiku game and completed, go to results
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
      setError(err instanceof Error ? err.message : 'Failed to submit concepts');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <ProgressBar currentStep={2} />

      <p className="subtitle">
        <span className="id">INS-001.2</span> · Step 2 of 3
      </p>
      <h1 className="title">Find your common ground.</h1>

      <p className="description">
        Enter single-word concepts that belong to both your anchor and target.
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
            Your Concepts{' '}
            <span style={{ color: 'var(--faded)', fontWeight: 'normal' }}>
              {validFilledCount}/5 concepts
            </span>
          </label>

          {steps.map((step, index) => {
            const validation = validations[index];
            const isValid = validation.status === 'valid';
            const isInvalid = validation.status === 'invalid';
            const isEmpty = validation.status === 'empty';

            return (
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
                  placeholder={index === 0 ? 'first concept' : ''}
                  autoComplete="off"
                  spellCheck="false"
                  autoFocus={index === 0}
                  disabled={isSubmitting}
                  style={{
                    flex: 1,
                    marginBottom: 0,
                    borderColor: isInvalid
                      ? 'var(--alert)'
                      : isValid
                      ? 'var(--active)'
                      : undefined,
                  }}
                />
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.65rem',
                    minWidth: '60px',
                    textAlign: 'right',
                    color: isInvalid
                      ? 'var(--alert)'
                      : isValid
                      ? 'var(--active)'
                      : 'var(--faded)',
                  }}
                >
                  {isInvalid && '✗'}
                  {isValid && '✓'}
                  {isEmpty && index > 0 && '(optional)'}
                </span>
              </div>
            );
          })}

          {/* Show first invalid error message */}
          {validations.map((v, i) =>
            v.status === 'invalid' && v.error ? (
              <div
                key={`error-${i}`}
                style={{
                  color: 'var(--alert)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.7rem',
                  marginTop: 'var(--space-xs)',
                }}
              >
                Concept {i + 1}: {v.error}
              </div>
            ) : null
          )}

          <p className="input-hint">
            At least 1 concept required. More concepts provide more signal.
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
            disabled={!canSubmit}
          >
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </Button>
        </div>
      </form>
    </div>
  );
};
