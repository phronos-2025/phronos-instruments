/**
 * Anchor-Target Screen - INS-001.2
 *
 * Step 1: Choose anchor and target words with suggestion feature.
 * Shows semantic distance between the two words.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useBridgingSenderState } from '../../../lib/bridging-state';
import { api, SemanticDistanceResponse } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';
import { Button } from '../../ui/Button';
import { ProgressBar } from '../../ui/ProgressBar';

interface AnchorTargetScreenProps {
  anchor?: string;
  target?: string;
}

export const AnchorTargetScreen: React.FC<AnchorTargetScreenProps> = ({
  anchor: initialAnchor,
  target: initialTarget,
}) => {
  const { dispatch } = useBridgingSenderState();
  const [anchor, setAnchor] = useState(initialAnchor || '');
  const [target, setTarget] = useState(initialTarget || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuggestingAnchor, setIsSuggestingAnchor] = useState(false);
  const [isSuggestingTarget, setIsSuggestingTarget] = useState(false);
  const [anchorSuggestAttempt, setAnchorSuggestAttempt] = useState(1);
  const [targetSuggestAttempt, setTargetSuggestAttempt] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [distance, setDistance] = useState<SemanticDistanceResponse | null>(null);
  const [isLoadingDistance, setIsLoadingDistance] = useState(false);

  // Ensure user is authenticated
  useEffect(() => {
    const ensureAuth = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Session error:', sessionError);
          setAuthReady(true);
          return;
        }

        if (!session) {
          console.log('No session found, signing in anonymously...');
          const { error: authError } = await supabase.auth.signInAnonymously();

          if (authError) {
            console.error('Auth error:', authError);
            setError(`Authentication failed: ${authError.message}`);
            setAuthReady(true);
            return;
          }
        }

        setAuthReady(true);
      } catch (err) {
        console.error('Auth setup error:', err);
        setAuthReady(true);
      }
    };

    ensureAuth();
  }, []);

  // Fetch semantic distance when both words are entered
  const fetchDistance = useCallback(async (a: string, t: string) => {
    if (!a.trim() || !t.trim() || !authReady) {
      setDistance(null);
      return;
    }

    const anchorClean = a.trim().toLowerCase();
    const targetClean = t.trim().toLowerCase();

    if (anchorClean === targetClean) {
      setDistance({
        anchor: anchorClean,
        target: targetClean,
        distance: 0,
        interpretation: 'identical',
      });
      return;
    }

    setIsLoadingDistance(true);
    try {
      const result = await api.bridging.getDistance(anchorClean, targetClean);
      setDistance(result);
    } catch (err) {
      console.error('Failed to get distance:', err);
      setDistance(null);
    } finally {
      setIsLoadingDistance(false);
    }
  }, [authReady]);

  // Debounce distance fetching
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchDistance(anchor, target);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [anchor, target, fetchDistance]);

  const handleSuggestAnchor = async () => {
    setIsSuggestingAnchor(true);
    try {
      // If target exists, suggest a word distant from it
      const response = await api.bridging.suggest(target || undefined, anchorSuggestAttempt);
      setAnchor(response.suggestion);
      setAnchorSuggestAttempt((a) => a + 1);
    } catch (err) {
      console.error('Suggest failed:', err);
    } finally {
      setIsSuggestingAnchor(false);
    }
  };

  const handleSuggestTarget = async () => {
    setIsSuggestingTarget(true);
    try {
      // If anchor exists, suggest a word distant from it
      const response = await api.bridging.suggest(anchor || undefined, targetSuggestAttempt);
      setTarget(response.suggestion);
      setTargetSuggestAttempt((a) => a + 1);
    } catch (err) {
      console.error('Suggest failed:', err);
    } finally {
      setIsSuggestingTarget(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!anchor.trim() || !target.trim() || !authReady) return;

    const anchorClean = anchor.trim().toLowerCase();
    const targetClean = target.trim().toLowerCase();

    if (anchorClean === targetClean) {
      setError('Anchor and target must be different words');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await api.bridging.create({
        anchor_word: anchorClean,
        target_word: targetClean,
        recipient_type: 'haiku', // Default to Haiku for immediate feedback
      });

      dispatch({
        type: 'GAME_CREATED',
        gameId: response.game_id,
        anchor: response.anchor_word,
        target: response.target_word,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create game');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format distance for display using DAT norms
  const formatDistance = (d: SemanticDistanceResponse) => {
    // Labels aligned with DAT norms (Olson et al., 2021)
    const labels: Record<string, string> = {
      identical: 'identical',
      close: 'close · try more distant concepts',
      'below average': 'below average distance',
      average: 'average distance',
      'above average': 'good distance',
      distant: 'very distant',
    };
    return labels[d.interpretation] || d.interpretation;
  };

  // Check if distance is good for a challenging task
  const isGoodDistance = (d: SemanticDistanceResponse) => {
    return d.interpretation === 'above average' || d.interpretation === 'distant';
  };

  return (
    <div>
      <ProgressBar currentStep={1} />

      <p className="subtitle">
        <span className="id">INS-001.2</span> · Step 1 of 3
      </p>
      <h1 className="title">Choose your anchor and target.</h1>

      <p className="description">
        Pick two words to connect. Your concepts will build a union between them.
      </p>

      {!authReady ? (
        <div
          style={{ textAlign: 'center', padding: '2rem', color: 'var(--faded)' }}
        >
          Initializing...
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 'var(--space-lg)',
              marginBottom: 'var(--space-lg)',
            }}
          >
            {/* Anchor Input */}
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Anchor</label>
              <input
                type="text"
                className="text-input"
                value={anchor}
                onChange={(e) => setAnchor(e.target.value)}
                placeholder="coffee"
                autoComplete="off"
                spellCheck="false"
                autoFocus
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={handleSuggestAnchor}
                disabled={isSuggestingAnchor || isSubmitting}
                style={{
                  marginTop: 'var(--space-xs)',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'var(--faded)',
                  padding: '0.5rem 1rem',
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                  borderRadius: '4px',
                }}
              >
                {isSuggestingAnchor ? '...' : 'Suggest'}
              </button>
            </div>

            {/* Target Input */}
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Target</label>
              <input
                type="text"
                className="text-input"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="sunshine"
                autoComplete="off"
                spellCheck="false"
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={handleSuggestTarget}
                disabled={isSuggestingTarget || isSubmitting}
                style={{
                  marginTop: 'var(--space-xs)',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'var(--faded)',
                  padding: '0.5rem 1rem',
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                  borderRadius: '4px',
                }}
              >
                {isSuggestingTarget ? '...' : 'Suggest'}
              </button>
            </div>
          </div>

          {/* Bridge visualization with distance */}
          {anchor && target && (
            <div
              style={{
                textAlign: 'center',
                fontFamily: 'var(--font-mono)',
                marginBottom: 'var(--space-lg)',
                padding: 'var(--space-md)',
                border: '1px solid var(--gold-dim)',
                borderRadius: '4px',
              }}
            >
              {/* Distance label */}
              {distance && !isLoadingDistance && (
                <div
                  style={{
                    fontSize: '0.7rem',
                    color: distance.interpretation === 'identical'
                      ? 'var(--alert)'
                      : isGoodDistance(distance)
                        ? 'var(--gold)'
                        : 'var(--faded)',
                    marginBottom: 'var(--space-xs)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {formatDistance(distance)}
                </div>
              )}
              {isLoadingDistance && (
                <div
                  style={{
                    fontSize: '0.7rem',
                    color: 'var(--faded)',
                    marginBottom: 'var(--space-xs)',
                  }}
                >
                  ...
                </div>
              )}

              {/* Arrow visualization */}
              <div
                style={{
                  fontSize: '0.9rem',
                  color: 'var(--gold)',
                }}
              >
                {anchor.toLowerCase()} ←――――――――――――――――→ {target.toLowerCase()}
              </div>
            </div>
          )}

          <p className="input-hint">
            Tip: Distant concepts make for more interesting unions.
          </p>

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
              disabled={
                !anchor.trim() || !target.trim() || isSubmitting || !authReady
              }
            >
              {isSubmitting ? 'Creating...' : 'Continue →'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};
