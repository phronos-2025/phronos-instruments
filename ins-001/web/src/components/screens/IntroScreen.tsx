/**
 * Intro Screen
 * 
 * Consent checkbox, "How it works" panel, "Begin Assessment" CTA
 */

import React, { useState } from 'react';
import { useGameState } from '../../lib/state';
import { Panel } from '../ui/Panel';
import { Button } from '../ui/Button';

export const IntroScreen: React.FC = () => {
  const { dispatch } = useGameState();
  const [consentAccepted, setConsentAccepted] = useState(false);
  
  const handleBegin = () => {
    if (consentAccepted) {
      dispatch({ type: 'BEGIN' });
    }
  };
  
  return (
    <div>
      <Panel title="Data Constitution">
        <p style={{ marginBottom: '1rem', color: 'var(--faded)' }}>
          Your data belongs to you. Participation is voluntary. Consent is explicit.
        </p>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={consentAccepted}
            onChange={(e) => setConsentAccepted(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-light)' }}>
            I have read and agree to the{' '}
            <a href="https://phronos.org/constitution" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold)' }}>
              Data Constitution
            </a>
          </span>
        </label>
      </Panel>
      
      <Panel title="How It Works">
        <ol style={{ paddingLeft: '1.5rem', color: 'var(--faded)', lineHeight: '1.8' }}>
          <li>Enter a seed word (any word you choose)</li>
          <li>Write 5 clues that hint at your word</li>
          <li>Share with a friend or test with AI</li>
          <li>See how well your associations communicate</li>
        </ol>
      </Panel>
      
      <div style={{ textAlign: 'center', marginTop: '2rem' }}>
        <Button
          variant="primary"
          onClick={handleBegin}
          disabled={!consentAccepted}
        >
          Begin Assessment
        </Button>
      </div>
    </div>
  );
};
