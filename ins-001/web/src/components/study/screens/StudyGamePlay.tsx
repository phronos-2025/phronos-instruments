/**
 * Study Game Play Screen (v3)
 *
 * Word input fields with count-up timer. No auto-submit.
 * Timer colors: green (0-59s), yellow (60-119s), red (120+).
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStudy } from '../../../lib/study-state';
import { api } from '../../../lib/api';
import { Button } from '../../ui/Button';

export function StudyGamePlay() {
  const { state, dispatch } = useStudy();
  const item = state.currentItem!;
  const config = item.config;

  const [words, setWords] = useState<string[]>(Array(config.n).fill(''));
  const [elapsed, setElapsed] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const startTimeRef = useRef(Date.now());
  const submittedRef = useRef(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Count-up timer
  useEffect(() => {
    if (!config.show_timer) return;
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [config.show_timer]);

  const handleSubmit = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);

    const filledWords = words.filter(w => w.trim().length > 0);
    if (filledWords.length === 0) {
      submittedRef.current = false;
      setSubmitting(false);
      dispatch({ type: 'ERROR', message: 'No words entered. Please try again.' });
      return;
    }

    const timeMs = Date.now() - startTimeRef.current;

    try {
      const score = await api.studies.submitGame(
        state.slug,
        item.game_id!,
        filledWords,
        false, // never auto-submitted in v3
        timeMs,
      );
      dispatch({ type: 'GAME_SCORED', score });
    } catch (e: any) {
      submittedRef.current = false;
      setSubmitting(false);
      dispatch({ type: 'ERROR', message: e.message || 'Submission failed' });
    }
  }, [words, item.game_id, state.slug]);

  const setWord = (index: number, value: string) => {
    setWords(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (index < config.n - 1) {
        inputRefs.current[index + 1]?.focus();
      } else {
        handleSubmit();
      }
    }
  };

  const filledCount = words.filter(w => w.trim().length > 0).length;
  const canSubmit = filledCount >= (config.min_words || 1) && !submitting;

  // Timer color: green → yellow → red
  const timerColor = elapsed >= 120 ? '#CC5544' : elapsed >= 60 ? '#DDAA33' : '#44AA77';

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}:${sec.toString().padStart(2, '0')}` : `${sec}s`;
  };

  return (
    <div className="study-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)', marginTop: 'var(--space-sm)' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--faded)', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Item {config.item_number} of {state.totalItems}
        </span>
        {config.show_timer && (
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '1.2rem',
            fontWeight: 600,
            color: timerColor,
            transition: 'color 0.3s ease',
          }}>
            {formatTime(elapsed)}
          </span>
        )}
      </div>

      {/* Targets */}
      {config.targets.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xs)', justifyContent: 'center', marginBottom: 'var(--space-lg)' }}>
          {config.targets.map((t) => (
            <span key={t} style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.9rem',
              color: 'var(--gold)',
              background: 'var(--gold-dim)',
              padding: '4px 12px',
              border: '1px solid var(--gold)',
            }}>
              {t}
            </span>
          ))}
        </div>
      )}

      {/* Word inputs */}
      <div style={{ maxWidth: '400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
        {Array.from({ length: config.n }).map((_, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.65rem',
              color: 'var(--faded)',
              width: '20px',
              textAlign: 'right',
            }}>
              {i + 1}
            </span>
            <input
              ref={el => { inputRefs.current[i] = el; }}
              type="text"
              value={words[i]}
              onChange={(e) => setWord(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              disabled={submitting}
              placeholder={config.task === 'rat' ? 'Your answer...' : `Word ${i + 1}`}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              style={{
                flex: 1,
                padding: '10px var(--space-sm)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.9rem',
                background: 'rgba(255,255,255,0.03)',
                border: words[i].trim() ? '1px solid var(--gold)' : '1px solid var(--faded-light)',
                color: 'var(--text-light)',
                transition: 'border-color 0.2s ease',
              }}
            />
          </div>
        ))}
      </div>

      {/* Submit */}
      <div style={{ textAlign: 'center', marginTop: 'var(--space-lg)' }}>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          {submitting ? 'Submitting...' : `Submit ${filledCount > 0 ? `(${filledCount} word${filledCount !== 1 ? 's' : ''})` : ''}`}
        </Button>
        {filledCount > 0 && filledCount < (config.min_words || 1) && (
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--faded)', marginTop: 'var(--space-sm)' }}>
            Enter at least {config.min_words} word{config.min_words !== 1 ? 's' : ''} to submit
          </p>
        )}
      </div>
    </div>
  );
}
