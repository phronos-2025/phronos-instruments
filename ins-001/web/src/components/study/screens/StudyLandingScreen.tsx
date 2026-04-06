/**
 * Study Landing Screen
 *
 * Title, description, participant count, and "Begin" CTA.
 */

import React from 'react';
import { useStudy } from '../../../lib/study-state';
import { useAuth } from '../../auth/AuthProvider';
import { api } from '../../../lib/api';
import { Panel } from '../../ui/Panel';
import { Button } from '../../ui/Button';

export function StudyLandingScreen() {
  const { state, dispatch } = useStudy();
  const { user } = useAuth();
  const study = state.study!;

  const handleBegin = async () => {
    if (!user) {
      // Need to create account first
      dispatch({ type: 'GO_TO', screen: 'account' });
      return;
    }

    // Already logged in — enroll and check consent
    try {
      const enrollment = await api.studies.enroll(state.slug);
      dispatch({
        type: 'ENROLLED',
        enrollmentId: enrollment.enrollment_id,
        itemsCompleted: enrollment.items_completed ?? enrollment.games_completed,
      });

      if (enrollment.already_enrolled && (enrollment.items_completed ?? enrollment.games_completed) > 0) {
        // Resume — fetch full progress
        const progress = await api.studies.getProgress(state.slug);
        dispatch({ type: 'RESUME', progress });
      } else {
        dispatch({ type: 'GO_TO', screen: 'consent' });
      }
    } catch (e: any) {
      dispatch({ type: 'ERROR', message: e.message });
    }
  };

  return (
    <div className="study-container">
      <div className="study-header">
        <p className="subtitle">
          <span className="id">STUDY</span> · instruments.phronos.org
        </p>
        <h1 className="title">{study.title}</h1>
      </div>

      {study.description && (
        <p className="description" style={{ maxWidth: '600px', margin: '0 auto var(--space-lg)' }}>
          {study.description}
        </p>
      )}

      <Panel title="What to Expect" meta="~15–20 minutes">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 'var(--space-md)',
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
        }}>
          <div>
            <div style={{ color: 'var(--gold)', fontSize: '1.5rem', marginBottom: 'var(--space-xs)' }}>01</div>
            <div style={{ color: 'var(--text-light)', marginBottom: '4px' }}>Word tasks</div>
            <div style={{ color: 'var(--faded)', fontSize: '0.65rem' }}>Generate and evaluate semantic associations.</div>
          </div>
          <div>
            <div style={{ color: 'var(--gold)', fontSize: '1.5rem', marginBottom: 'var(--space-xs)' }}>02</div>
            <div style={{ color: 'var(--text-light)', marginBottom: '4px' }}>See your scores</div>
            <div style={{ color: 'var(--faded)', fontSize: '0.65rem' }}>Divergence. Alignment. Parsimony.</div>
          </div>
          <div>
            <div style={{ color: 'var(--gold)', fontSize: '1.5rem', marginBottom: 'var(--space-xs)' }}>03</div>
            <div style={{ color: 'var(--text-light)', marginBottom: '4px' }}>Compare with peers</div>
            <div style={{ color: 'var(--faded)', fontSize: '0.65rem' }}>See how you rank in the cohort.</div>
          </div>
        </div>
      </Panel>

      <div style={{ textAlign: 'center', marginTop: 'var(--space-md)' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--faded)', marginBottom: 'var(--space-sm)' }}>
          {study.participant_count} participant{study.participant_count !== 1 ? 's' : ''} completed
        </div>

        <div className="btn-group">
          <Button variant="primary" onClick={handleBegin}>
            Begin Study
          </Button>
        </div>
      </div>

      <footer style={{ textAlign: 'center', marginTop: 'var(--space-2xl)', fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--faded)' }}>
        © Phronos 2026. All rights reserved.
      </footer>
    </div>
  );
}
