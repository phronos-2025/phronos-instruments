/**
 * Concepts Screen (formerly Clues Screen)
 *
 * Noise floor visualization, 1-5 concept inputs with morphological validation
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useGameState } from '../../lib/state';
import { api } from '../../lib/api';
import type { NoiseFloorWord, ClueTiming } from '../../lib/api';
import { Panel } from '../ui/Panel';
import { Button } from '../ui/Button';
import { ProgressBar } from '../ui/ProgressBar';
import { NoiseFloor } from '../ui/NoiseFloor';

interface CluesScreenProps {
  gameId: string;
  noiseFloor: NoiseFloorWord[];
  seedWord: string;
}

// Morphological variant detection (mirrors backend logic)
function getWordStem(word: string): string {
  word = word.toLowerCase();
  const suffixes = [
    'ically', 'ation', 'ness', 'ment', 'able', 'ible', 'tion',
    'sion', 'ally', 'ical', 'ful', 'less', 'ing', 'ity', 'ous', 'ive',
    'est', 'ier', 'ies', 'ied', 'ic', 'ly', 'ed', 'er', 'en', 'es', 's'
  ];
  for (const suffix of suffixes) {
    if (word.endsWith(suffix) && word.length > suffix.length + 2) {
      return word.slice(0, -suffix.length);
    }
  }
  return word;
}

function normalizeStem(word: string): string {
  // Normalize stem for Y→I transformations (mystery/mysteries/mysterious/mysteriously)
  // Uses limited recursion for compound suffixes like "-ously" = "-ous" + "-ly"
  let stem = getWordStem(word.toLowerCase());

  // Second pass: handle compound suffixes (e.g., mysteriously -> mysterious -> mysteri)
  // Only do one more pass to avoid over-stemming (myster -> myst)
  const secondStem = getWordStem(stem);
  // Only accept second stemming if it ends in 'i' (indicating y→i transformation)
  if (secondStem.endsWith('i')) {
    stem = secondStem;
  }

  // Normalize y/i endings for comparison
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

  // Get prefix-stripped versions
  const w1Stripped = stripCommonPrefixes(w1);
  const w2Stripped = stripCommonPrefixes(w2);

  // Check prefix-based variants (certainty/uncertainty)
  if (w1Stripped === w2Stripped) return true;
  if (w1Stripped === w2 || w2Stripped === w1) return true;

  // Get normalized stems for all versions
  const stem1 = normalizeStem(w1);
  const stem2 = normalizeStem(w2);
  const stem1Stripped = normalizeStem(w1Stripped);
  const stem2Stripped = normalizeStem(w2Stripped);

  // Same normalized stem (handles y→i transformations like mystery/mysteries/mysterious)
  if (stem1 === stem2) return true;

  // Check normalized stems of prefix-stripped versions
  if (stem1Stripped === stem2Stripped) return true;

  // Cross-check: stripped version matches other's stem (uncertain vs certainty)
  if (w1Stripped === stem2 || w2Stripped === stem1) return true;
  if (stem1Stripped === stem2 || stem2Stripped === stem1) return true;

  // Check if one stripped version is substring of the other (within length limit)
  if (w1Stripped.startsWith(w2Stripped) || w2Stripped.startsWith(w1Stripped)) {
    if (Math.abs(w1Stripped.length - w2Stripped.length) <= 4) {
      return true;
    }
  }

  return false;
}

type ValidationStatus = 'empty' | 'valid' | 'invalid' | 'warning';

interface ConceptValidation {
  status: ValidationStatus;
  error?: string;
}

interface ConceptTiming {
  firstEnteredMs: number | null;
  lastModifiedMs: number | null;
}

export const CluesScreen: React.FC<CluesScreenProps> = ({
  gameId,
  noiseFloor,
  seedWord
}) => {
  const { dispatch } = useGameState();
  const [concepts, setConcepts] = useState<string[]>(['', '', '', '', '']);
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

  const updateConcept = (index: number, value: string) => {
    const newConcepts = [...concepts];
    newConcepts[index] = value;
    setConcepts(newConcepts);
    setError(null);

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
    const seedLower = seedWord.toLowerCase();
    const filledSoFar: string[] = [];

    return concepts.map((concept) => {
      const trimmed = concept.trim().toLowerCase();

      // Empty field - no validation needed
      if (!trimmed) {
        return { status: 'empty' as ValidationStatus };
      }

      // Check if it's a morphological variant of seed word
      if (isMorphologicalVariant(trimmed, seedLower)) {
        return {
          status: 'invalid' as ValidationStatus,
          error: `Too similar to target "${seedWord}"`,
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

      // Check if in noise floor or morphologically similar to noise floor (warning, not invalid)
      const isInNoiseFloor = noiseFloor.some(
        item => item.word.toLowerCase() === trimmed
      );
      const isMorphologicallySimilarToNoiseFloor = noiseFloor.some(
        item => isMorphologicalVariant(trimmed, item.word.toLowerCase())
      );

      // Valid - add to filled list for duplicate checking
      filledSoFar.push(trimmed);

      if (isInNoiseFloor || isMorphologicallySimilarToNoiseFloor) {
        return { status: 'warning' as ValidationStatus };
      }

      return { status: 'valid' as ValidationStatus };
    });
  }, [concepts, seedWord, noiseFloor]);

  // Count valid filled concepts (warnings count as valid for submission)
  const validFilledCount = validations.filter(
    (v) => v.status === 'valid' || v.status === 'warning'
  ).length;
  const hasInvalidConcepts = validations.some((v) => v.status === 'invalid');
  const canSubmit = validFilledCount > 0 && !hasInvalidConcepts && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Get only valid filled concepts (warnings are still valid)
      const validIndices = concepts
        .map((_, i) => i)
        .filter(i => validations[i].status === 'valid' || validations[i].status === 'warning');

      const validConcepts = validIndices.map(i => concepts[i].trim());

      // Build timing data for valid concepts
      const clueTimings: ClueTiming[] = validIndices
        .map(i => ({
          word: concepts[i].trim(),
          first_entered_ms: timings[i].firstEnteredMs ?? 0,
          last_modified_ms: timings[i].lastModifiedMs ?? 0,
        }));

      // Submit clues with timing
      await api.games.submitClues(gameId, {
        clues: validConcepts,
        clue_timings: clueTimings
      });

      // Fetch full game data and go directly to results (skip share screen)
      const game = await api.games.get(gameId);
      dispatch({
        type: 'GAME_COMPLETED',
        game
      });
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
        <span className="subtitle-id">INS-001.1</span> · Step 2 of 3
      </p>
      <h1 className="title">Provide your concepts.</h1>

      <p className="description">
        Enter single-word concepts that will help someone guess your target word:{' '}
        <span className="target-word">{seedWord}</span>
      </p>

      <Panel title="Semantic Neighborhood" meta="Top 10 predictable associations">
        <NoiseFloor words={noiseFloor} />
        <p className="hint-text">
          These are the most predictable associations. Your divergence score measures how far your concepts venture from this neighborhood.
        </p>
      </Panel>

      <form onSubmit={handleSubmit}>
        <Panel title="Your Concepts" meta={`${validFilledCount}/5 concepts`}>
          <div className="clue-inputs">
            {concepts.map((concept, index) => {
              const validation = validations[index];
              const isValid = validation.status === 'valid';
              const isInvalid = validation.status === 'invalid';
              const isWarning = validation.status === 'warning';
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
                    value={concept}
                    onChange={(e) => updateConcept(index, e.target.value)}
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
                        : isWarning
                        ? 'var(--gold)'
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
                        : isWarning
                        ? 'var(--gold)'
                        : isValid
                        ? 'var(--active)'
                        : 'var(--faded)',
                    }}
                  >
                    {isInvalid && '✗'}
                    {isWarning && '⚠'}
                    {isValid && '✓'}
                    {isEmpty && index > 0 && '(optional)'}
                  </span>
                </div>
              );
            })}

            {/* Show error messages */}
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

            <p className="input-hint" style={{ marginTop: 'var(--space-sm)' }}>
              At least 1 concept required. More concepts provide more signal.
            </p>
          </div>
        </Panel>

        {error && (
          <div className="error-message">
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
