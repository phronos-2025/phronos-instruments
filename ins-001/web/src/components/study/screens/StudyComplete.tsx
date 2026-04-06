/**
 * Study Complete Screen
 *
 * Thank you message and redirect to profile dashboard.
 */

import React, { useEffect, useState } from 'react';
import { useStudy } from '../../../lib/study-state';
import { Panel } from '../../ui/Panel';
import { Button } from '../../ui/Button';

export function StudyComplete() {
  const { state } = useStudy();
  const [countdown, setCountdown] = useState(5);

  // Auto-redirect to profile after 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          window.location.href = '/profile';
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="study-container">
      <div style={{ textAlign: 'center' }}>
        <h2 className="title" style={{ fontSize: '2rem' }}>Study Complete</h2>
        <p className="description" style={{ maxWidth: '500px', margin: 'var(--space-sm) auto var(--space-lg)' }}>
          Thank you for participating in the {state.study?.title || 'study'}.
          Your creativity profile is ready.
        </p>
      </div>

      <Panel style={{ maxWidth: '400px', margin: '0 auto', textAlign: 'center' }}>
        <p style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.8rem',
          color: 'var(--text-light)',
          marginBottom: 'var(--space-md)',
        }}>
          You completed {state.itemsCompleted} of {state.totalItems} items. View your peer comparison
          dashboard to see how you rank among other participants.
        </p>

        <Button variant="primary" onClick={() => { window.location.href = '/profile'; }}>
          View Dashboard
        </Button>

        <p style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.6rem',
          color: 'var(--faded)',
          marginTop: 'var(--space-sm)',
        }}>
          Redirecting in {countdown}s...
        </p>
      </Panel>

      <footer style={{ textAlign: 'center', marginTop: 'var(--space-2xl)', fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--faded)' }}>
        © Phronos 2026. All rights reserved.
      </footer>
    </div>
  );
}
