/**
 * Concepts Screen (formerly Clues Screen)
 *
 * Noise floor visualization, 1-5 concept inputs with morphological validation
 */

import React, { useState, useMemo } from 'react';
import { useGameState } from '../../lib/state';
import { api } from '../../lib/api';
import type { NoiseFloorWord } from '../../lib/api';
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

  // Same stem
  if (getWordStem(w1) === getWordStem(w2)) return true;

  return false;
}

type ValidationStatus = 'empty' | 'valid' | 'invalid' | 'warning';

interface ConceptValidation {
  status: ValidationStatus;
  error?: string;
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

  const updateConcept = (index: number, value: string) => {
    const newConcepts = [...concepts];
    newConcepts[index] = value;
    setConcepts(newConcepts);
    setError(null);
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
      const validConcepts = concepts
        .filter((_, i) => validations[i].status === 'valid' || validations[i].status === 'warning')
        .map((c) => c.trim());

      // Submit clues
      await api.games.submitClues(gameId, {
        clues: validConcepts
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
