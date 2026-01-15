/**
 * Bridging Intro Screen - INS-001.2
 *
 * Introduces the bridging game concept and gets user consent.
 */

import React, { useState, useEffect } from 'react';
import { useBridgingSenderState } from '../../../lib/bridging-state';
import { Panel } from '../../ui/Panel';
import { Button } from '../../ui/Button';
import { ProgressBar } from '../../ui/ProgressBar';
import { api } from '../../../lib/api';

export const BridgingIntroScreen: React.FC = () => {
  const { dispatch } = useBridgingSenderState();
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [termsAcceptedAt, setTermsAcceptedAt] = useState<string | null>(null);
  const [checkingConsent, setCheckingConsent] = useState(true);

  // Check if user has already accepted terms
  useEffect(() => {
    const checkTerms = async () => {
      try {
        const user = await api.users.getMe();
        if (user.terms_accepted_at) {
          setTermsAcceptedAt(user.terms_accepted_at);
          setConsentAccepted(true);
        }
      } catch {
        // Ignore errors - user may not be authenticated yet
      } finally {
        setCheckingConsent(false);
      }
    };
    checkTerms();
  }, []);

  const handleBegin = () => {
    if (consentAccepted) {
      dispatch({ type: 'BEGIN' });
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div>
      <ProgressBar currentStep={1} />

      <p className="subtitle">
        <span className="id">INS-001.2</span> · Common Ground
      </p>
      <h1 className="title">Find common ground.</h1>

      <p className="description">
        This instrument measures how you locate semantic intersection between
        two different conceptual domains. Choose two words and find concepts
        that belong to both.
      </p>

      <Panel title="How It Works" meta="~5 minutes">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 'var(--space-md)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
          }}
        >
          <div>
            <div
              style={{
                color: 'var(--gold)',
                fontSize: '1.5rem',
                marginBottom: 'var(--space-xs)',
              }}
            >
              01
            </div>
            <div style={{ color: 'var(--text-light)', marginBottom: '4px' }}>
              Choose two words
            </div>
            <div style={{ color: 'var(--faded)', fontSize: '0.65rem' }}>
              Anchor and target.
            </div>
          </div>
          <div>
            <div
              style={{
                color: 'var(--gold)',
                fontSize: '1.5rem',
                marginBottom: 'var(--space-xs)',
              }}
            >
              02
            </div>
            <div style={{ color: 'var(--text-light)', marginBottom: '4px' }}>
              Find common ground
            </div>
            <div style={{ color: 'var(--faded)', fontSize: '0.65rem' }}>
              1-5 clues that belong to both.
            </div>
          </div>
          <div>
            <div
              style={{
                color: 'var(--gold)',
                fontSize: '1.5rem',
                marginBottom: 'var(--space-xs)',
              }}
            >
              03
            </div>
            <div style={{ color: 'var(--text-light)', marginBottom: '4px' }}>
              See what emerges
            </div>
            <div style={{ color: 'var(--faded)', fontSize: '0.65rem' }}>
              Divergence. Relevance.
            </div>
          </div>
        </div>
      </Panel>

      <Panel
        className=""
        style={{ background: 'transparent', borderColor: 'var(--gold-dim)' }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.7rem',
            color: 'var(--faded)',
          }}
        >
          <strong style={{ color: 'var(--text-light)' }}>
            What this measures:
          </strong>
          <br />
          <br />
          <strong>Divergence</strong> — How far your clues arc from the direct
          path between anchor and target. High divergence indicates unexpected
          routes.
          <br />
          <br />
          <strong>Relevance</strong> — How connected your clues are to both anchor
          and target. High relevance indicates clues in the shared semantic
          neighborhood.
          <br />
          <br />
          <span style={{ fontSize: '0.65rem' }}>
            <a href="https://phronos.org/methods/semantic-association-metrics/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold)', textDecoration: 'none', borderBottom: '1px dotted' }}>MTH-002</a>
            {' '}· How scores are calculated |{' '}
            <a href="https://phronos.org/library/digital-validity/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold)', textDecoration: 'none', borderBottom: '1px dotted' }}>LIB-002</a>
            {' '}· The theory behind it
          </span>
        </div>
      </Panel>

      <div
        style={{
          marginBottom: 'var(--space-md)',
          textAlign: 'left',
          maxWidth: '500px',
        }}
      >
        <label
          style={{
            display: 'flex',
            gap: 'var(--space-sm)',
            alignItems: 'flex-start',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={consentAccepted}
            onChange={(e) => setConsentAccepted(e.target.checked)}
            disabled={checkingConsent}
            style={{
              marginTop: '4px',
              accentColor: 'var(--gold)',
              width: '16px',
              height: '16px',
              cursor: checkingConsent ? 'wait' : 'pointer',
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.7rem',
              color: 'var(--faded)',
              lineHeight: '1.5',
            }}
          >
            I agree to the{' '}
            <a
              href="https://phronos.org/terms"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--gold)',
                textDecoration: 'none',
                borderBottom: '1px dotted',
              }}
            >
              Terms of Service
            </a>{' '}
            and{' '}
            <a
              href="https://phronos.org/privacy"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'var(--gold)',
                textDecoration: 'none',
                borderBottom: '1px dotted',
              }}
            >
              Privacy Policy
            </a>
            , and consent to the processing of my responses as described
            therein.
            {termsAcceptedAt && (
              <span style={{ display: 'block', marginTop: '4px', color: 'var(--active)', fontSize: '0.65rem' }}>
                Previously accepted on {formatDate(termsAcceptedAt)}
              </span>
            )}
          </span>
        </label>
      </div>

      <div className="btn-group" style={{ marginTop: 0 }}>
        <Button variant="primary" onClick={handleBegin} disabled={!consentAccepted}>
          Begin Assessment
        </Button>
      </div>

      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.65rem',
          color: 'var(--faded)',
          marginTop: 'var(--space-lg)',
        }}
      >
        There are no correct answers—only your connections.
      </p>
    </div>
  );
};
