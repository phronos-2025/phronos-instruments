/**
 * Bridging Share Screen - INS-001.2
 *
 * Step 3: Show divergence score and share options.
 */

import React, { useState } from 'react';
import { useBridgingSenderState } from '../../../lib/bridging-state';
import { api } from '../../../lib/api';
import { Panel } from '../../ui/Panel';
import { Button } from '../../ui/Button';
import { ProgressBar } from '../../ui/ProgressBar';

interface BridgingShareScreenProps {
  gameId: string;
  anchor: string;
  target: string;
  steps: string[];
  divergence: number;
  shareCode?: string;
}

function getDivergenceInterpretation(score: number): {
  label: string;
  description: string;
} {
  if (score < 30) {
    return {
      label: 'Predictable',
      description: 'Your steps stay close to the direct path between anchor and target.',
    };
  } else if (score < 50) {
    return {
      label: 'Moderate',
      description: 'Your steps take a moderately creative route.',
    };
  } else if (score < 70) {
    return {
      label: 'Creative',
      description: 'Your steps arc away from the obvious path.',
    };
  } else {
    return {
      label: 'Highly Creative',
      description: 'Your steps take a highly unexpected route to connect the concepts.',
    };
  }
}

export const BridgingShareScreen: React.FC<BridgingShareScreenProps> = ({
  gameId,
  anchor,
  target,
  steps,
  divergence,
  shareCode: initialShareCode,
}) => {
  const { dispatch } = useBridgingSenderState();
  const [shareCode, setShareCode] = useState(initialShareCode || '');
  const [shareUrl, setShareUrl] = useState('');
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const [isGettingHaiku, setIsGettingHaiku] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const interpretation = getDivergenceInterpretation(divergence);

  const handleCreateShare = async () => {
    if (shareCode) {
      // Already have share code, just copy
      handleCopy();
      return;
    }

    setIsCreatingShare(true);
    setError(null);

    try {
      const response = await api.bridging.createShare(gameId);
      setShareCode(response.share_code);
      setShareUrl(response.share_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create share link');
    } finally {
      setIsCreatingShare(false);
    }
  };

  const handleCopy = async () => {
    const url = shareUrl || `${window.location.origin}/ins-001-2/join/${shareCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Failed to copy to clipboard');
    }
  };

  const handleLetHaikuGuess = async () => {
    setIsGettingHaiku(true);
    setError(null);

    try {
      await api.bridging.triggerHaikuGuess(gameId);
      const game = await api.bridging.get(gameId);
      dispatch({
        type: 'GAME_COMPLETED',
        game,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get Haiku guess');
    } finally {
      setIsGettingHaiku(false);
    }
  };

  return (
    <div>
      <ProgressBar currentStep={3} />

      <p className="subtitle">
        <span className="id">INS-001.2</span> · Step 3 of 3
      </p>
      <h1 className="title">Bridge submitted.</h1>

      {/* Bridge and steps display */}
      <div
        style={{
          textAlign: 'center',
          marginBottom: 'var(--space-lg)',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.9rem',
            color: 'var(--gold)',
            marginBottom: 'var(--space-md)',
          }}
        >
          {anchor} ←――――――――――――――――→ {target}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
            color: 'var(--text-light)',
          }}
        >
          {steps.join(' · ')}
        </div>
      </div>

      {/* Divergence Score */}
      <Panel
        title="Divergence"
        meta={Math.round(divergence).toString()}
        style={{ marginBottom: 'var(--space-lg)' }}
      >
        <div
          style={{
            marginBottom: 'var(--space-md)',
          }}
        >
          {/* Score bar */}
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: '4px',
              height: '8px',
              overflow: 'hidden',
              marginBottom: 'var(--space-xs)',
            }}
          >
            <div
              style={{
                background: 'var(--gold)',
                height: '100%',
                width: `${Math.min(100, divergence)}%`,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.65rem',
              color: 'var(--faded)',
            }}
          >
            <span>predictable</span>
            <span>creative</span>
          </div>
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            color: 'var(--text-light)',
          }}
        >
          <strong style={{ color: 'var(--gold)' }}>{interpretation.label}</strong>
          <br />
          <span style={{ color: 'var(--faded)' }}>{interpretation.description}</span>
        </div>
      </Panel>

      {/* Share options */}
      <p className="description">Who should build the bridge?</p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--space-md)',
          marginBottom: 'var(--space-lg)',
        }}
      >
        {/* Share with someone */}
        <button
          onClick={handleCreateShare}
          disabled={isCreatingShare}
          style={{
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: 'var(--space-md)',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'border-color 0.2s',
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.borderColor = 'var(--gold)')
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.borderColor = 'var(--border)')
          }
        >
          <div
            style={{
              fontSize: '1.5rem',
              marginBottom: 'var(--space-xs)',
            }}
          >
            🔗
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
              color: 'var(--text-light)',
              marginBottom: '4px',
            }}
          >
            Share with someone
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.65rem',
              color: 'var(--faded)',
            }}
          >
            Send a link to a friend or colleague
          </div>
        </button>

        {/* Let Haiku guess */}
        <button
          onClick={handleLetHaikuGuess}
          disabled={isGettingHaiku}
          style={{
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: 'var(--space-md)',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'border-color 0.2s',
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.borderColor = 'var(--gold)')
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.borderColor = 'var(--border)')
          }
        >
          <div
            style={{
              fontSize: '1.5rem',
              marginBottom: 'var(--space-xs)',
            }}
          >
            🤖
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
              color: 'var(--text-light)',
              marginBottom: '4px',
            }}
          >
            {isGettingHaiku ? 'Building...' : 'Let Haiku build'}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.65rem',
              color: 'var(--faded)',
            }}
          >
            See how Claude Haiku builds the same bridge
          </div>
        </button>
      </div>

      {/* Share link display */}
      {shareCode && (
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: 'var(--space-md)',
            marginBottom: 'var(--space-lg)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              color: 'var(--faded)',
              marginBottom: 'var(--space-xs)',
            }}
          >
            Share link
          </div>
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-sm)',
              alignItems: 'center',
            }}
          >
            <input
              type="text"
              readOnly
              value={shareUrl || `${window.location.origin}/ins-001-2/join/${shareCode}`}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8rem',
                color: 'var(--text-light)',
                outline: 'none',
              }}
            />
            <Button variant="secondary" onClick={handleCopy}>
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div
          style={{
            color: 'var(--alert)',
            marginBottom: 'var(--space-md)',
            fontSize: 'var(--text-sm)',
          }}
        >
          ◈ {error}
        </div>
      )}

      <div className="btn-group">
        <Button
          variant="ghost"
          onClick={() => dispatch({ type: 'RESET' })}
        >
          Build Another →
        </Button>
      </div>
    </div>
  );
};
