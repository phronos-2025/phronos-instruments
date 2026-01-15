/**
 * Results Screen
 *
 * Connected dot plot visualization for relevance/spread metrics,
 * matching INS-001.2 design with rows for You, Haiku, and Statistical.
 * "Unregistered Record" panel with progress, footer links
 */

import React, { useState } from 'react';
import { useGameState } from '../../lib/state';
import { api } from '../../lib/api';
import type { GameResponse } from '../../lib/api';
import { Panel } from '../ui/Panel';
import { Button } from '../ui/Button';
import { ShareLinkBox } from '../ui/ShareLinkBox';
import { MagicLinkModal } from '../auth/MagicLinkModal';

interface ResultsScreenProps {
  game: GameResponse;
}

// Dot plot row component (matching INS-001.2 BridgingResultsScreen)
interface DotPlotRowProps {
  label: string;
  concepts: string[];
  relevance: number;
  spread: number;
  isYou?: boolean;
}

// Human row placeholder for sharing
function HumanShareRow({
  shareUrl,
  isCreatingShare,
  shareError,
  onCreateShare,
}: {
  shareUrl: string | null;
  isCreatingShare: boolean;
  shareError: string | null;
  onCreateShare: () => void;
}) {
  return (
    <div style={{ marginBottom: 'var(--space-lg)' }}>
      {/* Placeholder concepts - offset to align with track, not label */}
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
          color: 'var(--faded)',
          marginBottom: 'var(--space-xs)',
          letterSpacing: '0.02em',
          fontStyle: 'italic',
          textAlign: 'center',
          marginLeft: '92px',
        }}
      >
        compare your concepts
      </div>

      {/* Row with label, track placeholder, and share button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
        {/* Label */}
        <div
          style={{
            width: '80px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.65rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: 'var(--text-light)',
          }}
        >
          Human
        </div>

        {/* Track placeholder with dashed line */}
        <div
          style={{
            flex: 1,
            height: '32px',
            position: 'relative',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '2px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Dashed placeholder line */}
          <div
            style={{
              position: 'absolute',
              left: '10%',
              right: '10%',
              top: '50%',
              height: '1px',
              borderTop: '1px dashed var(--faded-light)',
              transform: 'translateY(-50%)',
            }}
          />

          {/* Button only shown when no share URL yet */}
          {!shareUrl && (
            <div style={{ position: 'relative', zIndex: 1 }}>
              <Button
                variant="secondary"
                onClick={onCreateShare}
                disabled={isCreatingShare}
                style={{
                  fontSize: '0.65rem',
                  padding: '4px 12px',
                }}
              >
                {isCreatingShare ? 'Creating...' : 'Create Share Link'}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Share link shown below the track when created */}
      {shareUrl && (
        <div
          style={{
            marginTop: 'var(--space-sm)',
            marginLeft: '92px',
          }}
        >
          <ShareLinkBox url={shareUrl} />
        </div>
      )}

      {shareError && (
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.6rem',
            color: 'var(--alert)',
            marginTop: 'var(--space-xs)',
            marginLeft: '92px',
          }}
        >
          {shareError}
        </div>
      )}
    </div>
  );
}

function DotPlotRow({ label, concepts, relevance, spread, isYou }: DotPlotRowProps) {
  const scale = (val: number) => Math.min(100, Math.max(0, val));

  return (
    <div style={{ marginBottom: 'var(--space-lg)' }}>
      {/* Concepts above the track */}
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
          color: isYou ? 'var(--gold)' : 'var(--text-light)',
          marginBottom: 'var(--space-xs)',
          letterSpacing: '0.02em',
          textAlign: 'center',
          marginLeft: '92px',
        }}
      >
        {concepts.join(' · ')}
      </div>

      {/* Row with label, track, and values */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
        {/* Label */}
        <div
          style={{
            width: '80px',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.65rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: isYou ? 'var(--gold)' : 'var(--text-light)',
          }}
        >
          {label}
        </div>

        {/* Track */}
        <div
          style={{
            flex: 1,
            height: '32px',
            position: 'relative',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '2px',
            marginBottom: '16px',
          }}
        >
          {/* Gridlines */}
          {[25, 50, 75].map((v) => (
            <div
              key={v}
              style={{
                position: 'absolute',
                left: `${v}%`,
                top: 0,
                bottom: 0,
                width: '1px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
              }}
            />
          ))}

          {/* Connecting line */}
          <div
            style={{
              position: 'absolute',
              left: `${Math.min(scale(relevance), scale(spread))}%`,
              width: `${Math.abs(scale(spread) - scale(relevance))}%`,
              top: '50%',
              height: '2px',
              backgroundColor: 'var(--gold)',
              opacity: 0.4,
              transform: 'translateY(-50%)',
            }}
          />

          {/* Relevance dot (filled) */}
          <div
            style={{
              position: 'absolute',
              left: `${scale(relevance)}%`,
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: 'var(--gold)',
            }}
          />

          {/* Spread dot (hollow) */}
          <div
            style={{
              position: 'absolute',
              left: `${scale(spread)}%`,
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              border: '2px solid var(--gold)',
              backgroundColor: 'var(--bg)',
              boxSizing: 'border-box',
            }}
          />

          {/* Value labels */}
          <span
            style={{
              position: 'absolute',
              left: `${scale(relevance)}%`,
              bottom: '-16px',
              transform: 'translateX(-50%)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6rem',
              color: 'var(--gold)',
            }}
          >
            {Math.round(relevance)}
          </span>
          <span
            style={{
              position: 'absolute',
              left: `${scale(spread)}%`,
              bottom: '-16px',
              transform: 'translateX(-50%)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6rem',
              color: 'var(--faded)',
            }}
          >
            {Math.round(spread)}
          </span>
        </div>
      </div>
    </div>
  );
}

export const ResultsScreen: React.FC<ResultsScreenProps> = () => {
  const { state, dispatch } = useGameState();
  const game = state.screen === 'results' ? state.game : null;
  const [showInitModal, setShowInitModal] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  if (!game) return null;

  const handleCreateShareLink = async () => {
    if (!game.game_id) return;
    setIsCreatingShare(true);
    setShareError(null);
    try {
      const response = await api.share.createToken(game.game_id);
      const url = `${window.location.origin}/ins-001-1/join/${response.share_token}`;
      setShareUrl(url);
    } catch (err) {
      setShareError(err instanceof Error ? err.message : 'Failed to create share link');
    } finally {
      setIsCreatingShare(false);
    }
  };

  // Use new unified scoring if available, otherwise fall back to legacy mapping
  // New API: relevance (0-1), spread (0-100 DAT-style)
  // Legacy: divergence_score (0-1), convergence_score (0-1)
  const spreadDisplay = game.spread ?? (game.divergence_score ?? 0) * 100;
  const relevanceDisplay = game.relevance !== undefined
    ? game.relevance * 100  // Convert 0-1 to 0-100 for display
    : (game.convergence_score ?? 0) * 100;  // Legacy fallback

  // Haiku data (from LLM guesses - we'll show the guesses as Haiku's "clues")
  const hasHaikuData = game.recipient_type === 'llm' && game.guesses && game.guesses.length > 0;
  // For Haiku, we use guess similarities as a proxy for relevance
  const haikuRelevance = game.guess_similarities
    ? (game.guess_similarities.reduce((a, b) => a + b, 0) / game.guess_similarities.length) * 100
    : 0;
  // Haiku spread is estimated from variance of similarities (low variance = low spread)
  const haikuSpread = game.guess_similarities && game.guess_similarities.length > 1
    ? Math.min(100, Math.max(0,
        (1 - Math.max(...game.guess_similarities) + Math.min(...game.guess_similarities)) * 100
      ))
    : 50;

  const spreadInterpretation =
    spreadDisplay < 30 ? 'Low' : spreadDisplay < 60 ? 'Moderate' : 'High';

  const relevanceInterpretation =
    relevanceDisplay < 40 ? 'Weak' : relevanceDisplay < 70 ? 'Moderate' : 'Strong';

  // Format guesses for display as pills with shaded bars
  const formatGuess = (guess: string, index: number) => {
    const similarity = game.guess_similarities?.[index];
    const isExact = guess.toLowerCase() === game.seed_word.toLowerCase();
    const similarityPercent =
      similarity !== undefined ? Math.min(Math.max(similarity * 100, 0), 100) : 0;
    const borderColor = isExact ? 'var(--active)' : 'rgba(242, 240, 233, 0.15)';
    const textColor = isExact ? 'var(--active)' : 'var(--faded)';

    return (
      <span
        key={index}
        className="noise-word"
        data-similarity={similarity !== undefined ? similarity.toFixed(2) : '—'}
        style={
          {
            '--similarity-width': `${similarityPercent}%`,
            borderColor: borderColor,
            color: textColor,
          } as React.CSSProperties
        }
        title={
          similarity !== undefined ? `Similarity: ${similarity.toFixed(2)}` : 'Similarity: —'
        }
      >
        {guess}
      </span>
    );
  };

  return (
    <div>
      <p className="subtitle">
        <span className="id">INS-001.1</span> · Complete
      </p>
      <h1 className="title">Results.</h1>

      <p className="description">Your semantic association profile for this session.</p>

      <Panel>
        {/* Target word display */}
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
            color: 'var(--gold)',
            textAlign: 'center',
            marginBottom: 'var(--space-lg)',
          }}
        >
          Target: {game.seed_word}
        </div>

        {/* Legend */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 'var(--space-md)',
            marginBottom: 'var(--space-md)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.6rem',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: 'var(--faded)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 'var(--gold)',
              }}
            />
            <span>Relevance</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                border: '2px solid var(--gold)',
                backgroundColor: 'transparent',
                boxSizing: 'border-box',
              }}
            />
            <span>Spread</span>
          </div>
        </div>

        {/* Section: Your Clues */}
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.6rem',
            color: 'var(--faded)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: 'var(--space-xs)',
            marginTop: 'var(--space-md)',
          }}
        >
          Your Clues
        </div>

        {/* Axis scale */}
        <div style={{ marginLeft: '92px', marginRight: '12px', marginBottom: 'var(--space-sm)' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--faded)',
              marginBottom: '2px',
            }}
          >
            {[0, 25, 50, 75, 100].map((v) => (
              <span key={v}>{v}</span>
            ))}
          </div>
          <div
            style={{
              height: '1px',
              backgroundColor: 'var(--border)',
              position: 'relative',
            }}
          >
            {[0, 25, 50, 75, 100].map((v) => (
              <div
                key={v}
                style={{
                  position: 'absolute',
                  left: `${v}%`,
                  top: '-2px',
                  width: '1px',
                  height: '5px',
                  backgroundColor: 'var(--border)',
                }}
              />
            ))}
          </div>
        </div>

        {/* Dot plot visualization - rows for You, Haiku, Statistical */}
        <div style={{ marginTop: 'var(--space-md)' }}>
          {/* Your row */}
          <DotPlotRow
            label="You"
            concepts={game.clues || []}
            relevance={relevanceDisplay}
            spread={spreadDisplay}
            isYou
          />

          {/* Section: Guesses from your clues */}
          {(hasHaikuData || (game.noise_floor && game.noise_floor.length > 0)) && (
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.6rem',
                color: 'var(--faded)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: 'var(--space-xs)',
                marginTop: 'var(--space-lg)',
                paddingTop: 'var(--space-md)',
                borderTop: '1px solid var(--border)',
              }}
            >
              Guesses (from your clues)
            </div>
          )}

          {/* Haiku row - these are GUESSES of the target, not clues */}
          {hasHaikuData && (
            <DotPlotRow
              label="Haiku"
              concepts={game.guesses || []}
              relevance={haikuRelevance}
              spread={haikuSpread}
            />
          )}

          {/* Statistical row - using noise floor as baseline (show all words from previous screen) */}
          {game.noise_floor && game.noise_floor.length > 0 && (
            <>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.6rem',
                  color: 'var(--faded)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: 'var(--space-xs)',
                  marginTop: 'var(--space-lg)',
                  paddingTop: 'var(--space-md)',
                  borderTop: '1px solid var(--border)',
                }}
              >
                Noise Floor (predictable associations)
              </div>
              <DotPlotRow
                label="Statistical"
                concepts={game.noise_floor.map(w => w.word)}
                relevance={game.noise_floor.reduce((sum, w) => sum + w.similarity * 100, 0) / game.noise_floor.length}
                spread={50} // Noise floor is designed to have moderate spread
              />
            </>
          )}

          {/* Human row */}
          <HumanShareRow
            shareUrl={shareUrl}
            isCreatingShare={isCreatingShare}
            shareError={shareError}
            onCreateShare={handleCreateShareLink}
          />
        </div>
      </Panel>

      <Panel
        className=""
        style={{ background: 'transparent', borderColor: 'var(--faded-light)' }}
      >
        <div className="panel-header">
          <span className="panel-title">Interpretation</span>
        </div>
        <div
          className="panel-content"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.9rem',
            color: 'var(--faded)',
            lineHeight: '1.7',
          }}
        >
          <p style={{ marginBottom: 'var(--space-sm)' }}>
            Your clues show {spreadInterpretation.toLowerCase()} spread ({Math.round(spreadDisplay)})
            with {relevanceInterpretation.toLowerCase()} relevance ({Math.round(relevanceDisplay)}) to the target concept.
            {spreadDisplay > 60 && relevanceDisplay > 50 && ' This indicates creative but valid associations.'}
            {spreadDisplay < 40 && relevanceDisplay > 50 && ' This indicates conventional, predictable associations.'}
            {relevanceDisplay < 40 && ' The associations may be too distant from the target concept.'}
          </p>
          {hasHaikuData && (
            <p style={{ marginBottom: 0, fontSize: '0.8rem' }}>
              Haiku guessed "{game.guesses?.join(', ')}" from your clues —
              {haikuRelevance > 70
                ? ' accurately inferring the target.'
                : haikuRelevance > 40
                  ? ' getting close to the target.'
                  : ' struggling to identify the target.'}
            </p>
          )}
        </div>
      </Panel>

      <Panel
        className=""
        style={{
          borderColor: 'var(--gold)',
          background: 'linear-gradient(to bottom, var(--card-bg), rgba(176, 141, 85, 0.05))',
        }}
      >
        <div className="panel-header" style={{ borderBottomColor: 'var(--gold-dim)' }}>
          <span className="panel-title" style={{ color: 'var(--gold)' }}>
            Unregistered Record
          </span>
          <span className="panel-meta">
            Session ID: #{game.game_id?.slice(0, 4).toUpperCase() || '----'}
          </span>
        </div>
        <div className="panel-content">
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-md)',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: 1, minWidth: '200px' }}>
              <p
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  color: 'var(--text-light)',
                  marginBottom: 'var(--space-xs)',
                }}
              >
                Save your scores to your permanent cognitive profile.
              </p>
            </div>

            <Button
              variant="primary"
              style={{ fontSize: '0.65rem', padding: '10px 20px' }}
              onClick={() => setShowInitModal(true)}
            >
              Initialize ID
            </Button>
          </div>
        </div>
      </Panel>

      <div className="btn-group">
        <Button
          variant="secondary"
          onClick={() => {
            dispatch({ type: 'RESET' });
            window.location.reload();
          }}
        >
          Play Again
        </Button>
      </div>

      <footer className="footer">
        <div>
          <a href="/methods" style={{ color: 'var(--faded)', textDecoration: 'none' }}>
            Methodology
          </a>{' '}
          ·{' '}
          <a href="/about" style={{ color: 'var(--faded)', textDecoration: 'none' }}>
            About Phronos
          </a>{' '}
          ·{' '}
          <a href="/constitution" style={{ color: 'var(--faded)', textDecoration: 'none' }}>
            Constitution
          </a>
        </div>
        <div>© 2026 Phronos Observatory</div>
      </footer>

      <MagicLinkModal isOpen={showInitModal} onClose={() => setShowInitModal(false)} />
    </div>
  );
};
