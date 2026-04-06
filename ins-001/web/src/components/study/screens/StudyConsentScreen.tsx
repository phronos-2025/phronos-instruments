/**
 * Study Consent Screen
 *
 * Checkbox consent with study-specific addendum about research use.
 */

import React, { useState } from 'react';
import { useStudy } from '../../../lib/study-state';
import { api } from '../../../lib/api';
import { Panel } from '../../ui/Panel';
import { Button } from '../../ui/Button';

export function StudyConsentScreen() {
  const { state, dispatch } = useStudy();
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    if (!accepted) return;
    setLoading(true);
    try {
      await api.studies.consent(state.slug);
      dispatch({ type: 'GO_TO', screen: 'pre_survey' });
    } catch (e: any) {
      dispatch({ type: 'ERROR', message: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="study-container">
      <h2 className="title" style={{ fontSize: '1.8rem' }}>Consent</h2>

      <Panel>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--faded)', lineHeight: 1.8 }}>
          <p style={{ marginBottom: 'var(--space-md)' }}>
            This study measures creativity through semantic association tasks. You will play
            10 timed word games and answer brief questionnaires before and after.
          </p>

          <p style={{ marginBottom: 'var(--space-md)' }}>
            <strong style={{ color: 'var(--text-light)' }}>Research use:</strong> Your responses will
            be analyzed as part of a research study on creativity measurement. Your scores will be
            compared against other participants in this study. Individual responses are never shared
            publicly; only aggregate statistics are visible to other participants.
          </p>

          <p style={{ marginBottom: 'var(--space-md)' }}>
            <strong style={{ color: 'var(--text-light)' }}>Your data:</strong> You may withdraw at any
            time by contacting{' '}
            <a href="mailto:it-admin@phronos.org" style={{ color: 'var(--gold)', textDecoration: 'none', borderBottom: '1px dotted' }}>
              it-admin@phronos.org
            </a>.
          </p>

          <p>
            <strong style={{ color: 'var(--text-light)' }}>Duration:</strong> approximately 15–20 minutes.
            You may pause and return later; your progress is saved.
          </p>
        </div>
      </Panel>

      <div style={{ marginTop: 'var(--space-md)', marginBottom: 'var(--space-md)', textAlign: 'left', maxWidth: '500px', margin: 'var(--space-md) auto' }}>
        <label style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'flex-start', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            style={{ marginTop: '4px', accentColor: 'var(--gold)', width: '16px', height: '16px', cursor: 'pointer' }}
          />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--faded)', lineHeight: '1.5' }}>
            I agree to the{' '}
            <a href="https://phronos.org/terms" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold)', textDecoration: 'none', borderBottom: '1px dotted' }}>
              Terms of Service
            </a>
            {' '}and{' '}
            <a href="https://phronos.org/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold)', textDecoration: 'none', borderBottom: '1px dotted' }}>
              Privacy Policy
            </a>
            , and consent to the processing of my responses as described above.
          </span>
        </label>
      </div>

      <div className="btn-group" style={{ textAlign: 'center' }}>
        <Button variant="primary" onClick={handleContinue} disabled={!accepted || loading}>
          {loading ? 'Saving...' : 'Continue'}
        </Button>
      </div>
    </div>
  );
}
