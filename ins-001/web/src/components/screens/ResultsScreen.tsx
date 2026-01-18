/**
 * Results Screen (INS-001.1)
 *
 * Redesigned UI with SpreadBar visualization, conventionality indicator,
 * and AI interpretation section.
 */

import React, { useState } from 'react';
import { useGameState } from '../../lib/state';
import { useAuth } from '../auth/AuthProvider';
import { api } from '../../lib/api';
import type { GameResponse, NoiseFloorWord } from '../../lib/api';
import { Panel } from '../ui/Panel';
import { Button } from '../ui/Button';
import { ShareLinkBox } from '../ui/ShareLinkBox';
import { MagicLinkModal } from '../auth/MagicLinkModal';

interface ResultsScreenProps {
  game: GameResponse;
}

// INS-001.1 calibrated interpretation bands
// Based on calibration data - different from INS-001.2
const SPREAD_BANDS = [
  { max: 59, label: 'Low', description: 'Constrained/repetitive associations' },
  { max: 62, label: 'Below Average', description: 'Somewhat conventional' },
  { max: 69, label: 'Average', description: 'Typical divergent range' },
  { max: 72, label: 'Above Average', description: 'Creative/exploratory' },
  { max: 100, label: 'High', description: 'Highly divergent' },
];

const DAT_REFERENCE = 74.1; // DAT reference score for context

function getSpreadInterpretation(score: number): { label: string; description: string } {
  for (const band of SPREAD_BANDS) {
    if (score < band.max) {
      return { label: band.label, description: band.description };
    }
  }
  return SPREAD_BANDS[SPREAD_BANDS.length - 1];
}

// Morphological variant detection (mirrors CluesScreen logic)
function getWordStem(word: string): string {
  word = word.toLowerCase();
  const suffixes = [
    'ically', 'ation', 'ness', 'ment', 'able', 'ible', 'tion',
    'sion', 'ally', 'ical', 'ful', 'less', 'ing', 'ity', 'ous', 'ive',
    'est', 'ier', 'ies', 'ied', 'ic', 'ly', 'ed', 'er', 'en', 'es', 's'
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
  if (w1 === w2) return true;
  if (w1.startsWith(w2) || w2.startsWith(w1)) {
    if (Math.abs(w1.length - w2.length) <= 4) return true;
  }
  const stem1 = getWordStem(w1);
  const stem2 = getWordStem(w2);
  return stem1 === stem2;
}

// Calculate conventionality based on noise floor overlap
function calculateConventionality(
  associations: string[],
  noiseFloor: NoiseFloorWord[]
): { level: 'Low' | 'Moderate' | 'High'; overlaps: number; description: string } {
  const overlaps = associations.filter(assoc =>
    noiseFloor.some(nf =>
      nf.word.toLowerCase() === assoc.toLowerCase() ||
      isMorphologicalVariant(assoc, nf.word)
    )
  ).length;

  if (overlaps === 0) {
    return { level: 'Low', overlaps, description: 'Your associations were unexpected—you avoided the obvious connections.' };
  } else if (overlaps <= 2) {
    return { level: 'Moderate', overlaps, description: 'Your associations included some expected words, with original additions.' };
  } else {
    return { level: 'High', overlaps, description: 'Your associations clustered around predictable connections.' };
  }
}

// SpreadBar component - single horizontal bar with marker
interface SpreadBarProps {
  score: number;
  interpretation: { label: string; description: string };
}

function SpreadBar({ score, interpretation }: SpreadBarProps) {
  // Scale: 0-80 to fit bands nicely, with DAT reference visible
  const maxScale = 80;
  const position = Math.min(100, (score / maxScale) * 100);
  const datPosition = (DAT_REFERENCE / maxScale) * 100;

  // Band positions (as percentages of maxScale)
  const bandPositions = [
    { pos: (59 / maxScale) * 100, label: 'Low' },
    { pos: (62 / maxScale) * 100, label: 'Below Avg' },
    { pos: (69 / maxScale) * 100, label: 'Average' },
    { pos: (72 / maxScale) * 100, label: 'Above Avg' },
    { pos: datPosition, label: 'High' },
  ];

  return (
    <div style={{ marginBottom: 'var(--space-lg)' }}>
      {/* Score and interpretation label */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 'var(--space-sm)',
        marginBottom: 'var(--space-sm)',
        fontFamily: 'var(--font-mono)',
      }}>
        <span style={{ fontSize: '1.5rem', color: 'var(--gold)', fontWeight: 600 }}>
          {Math.round(score)}
        </span>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-light)' }}>
          {interpretation.label}
        </span>
      </div>

      {/* The bar track */}
      <div style={{
        position: 'relative',
        height: '8px',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '4px',
        marginBottom: '24px',
      }}>
        {/* Filled portion up to score */}
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          height: '100%',
          width: `${position}%`,
          backgroundColor: 'var(--gold)',
          borderRadius: '4px',
          transition: 'width 0.3s ease',
        }} />

        {/* Marker at score position */}
        <div style={{
          position: 'absolute',
          left: `${position}%`,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          backgroundColor: 'var(--gold)',
          border: '3px solid var(--bg)',
          boxShadow: '0 0 0 1px var(--gold)',
        }} />

        {/* Band tick marks */}
        {bandPositions.map((band, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${band.pos}%`,
              top: '100%',
              transform: 'translateX(-50%)',
            }}
          >
            <div style={{
              width: '1px',
              height: '8px',
              backgroundColor: 'var(--border)',
              marginBottom: '4px',
            }} />
            <span style={{
              display: 'block',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.55rem',
              color: 'var(--faded)',
              whiteSpace: 'nowrap',
              textAlign: 'center',
            }}>
              {band.label}
            </span>
          </div>
        ))}

        {/* DAT reference marker */}
        <div style={{
          position: 'absolute',
          left: `${datPosition}%`,
          top: '100%',
          transform: 'translateX(-50%)',
        }}>
          <div style={{
            width: '1px',
            height: '8px',
            backgroundColor: 'var(--faded)',
            marginBottom: '4px',
          }} />
          <span style={{
            display: 'block',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.55rem',
            color: 'var(--faded)',
            whiteSpace: 'nowrap',
          }}>
            (DAT)
          </span>
        </div>
      </div>

      {/* DAT reference note if score is high */}
      {score > 72 && (
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.65rem',
          color: 'var(--faded)',
          marginTop: 'var(--space-md)',
        }}>
          Approaching DAT reference ({DAT_REFERENCE})
        </div>
      )}
    </div>
  );
}

export const ResultsScreen: React.FC<ResultsScreenProps> = () => {
  const { state, dispatch } = useGameState();
  const { user, loading: authLoading } = useAuth();
  const game = state.screen === 'results' ? state.game : null;
  const [showInitModal, setShowInitModal] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  // Check if user is registered (has email, not anonymous)
  const isRegistered = user?.email && !user?.is_anonymous;

  if (!game) return null;

  const handleCreateShareLink = async () => {
    if (!game.game_id) return;
    setIsCreatingShare(true);
    setShareError(null);
    try {
      const response = await api.share.createToken(game.game_id);
      const url = `${window.location.origin}/ins-001/ins-001-1/join/${response.token}`;
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

  // Get interpretation using INS-001.1 calibrated bands
  const spreadInterp = getSpreadInterpretation(spreadDisplay);

  // Haiku data (from LLM guesses)
  const hasHaikuData = game.recipient_type === 'llm' && game.guesses && game.guesses.length > 0;
  const targetWord = game.seed_word?.toLowerCase();
  const haikuGuessedCorrectly = game.guesses?.some(
    (guess) => guess.toLowerCase() === targetWord
  );

  // Calculate conventionality based on noise floor overlap
  const associations = game.clues || [];
  const noiseFloor = game.noise_floor || [];
  const conventionality = calculateConventionality(associations, noiseFloor);

  // Get other guesses for display (excluding exact match if present)
  const otherGuesses = game.guesses?.filter(g => g.toLowerCase() !== targetWord) || [];

  return (
    <div>
      <p className="subtitle">
        <span className="id">INS-001.1</span> · Complete
      </p>
      <h1 className="title">Results.</h1>

      <p className="description">Your semantic association profile for this session.</p>

      {/* Main results panel */}
      <Panel>
        {/* Your associations header */}
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.65rem',
          color: 'var(--faded)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: 'var(--space-xs)',
        }}>
          Your associations for "{game.seed_word}"
        </div>

        {/* Display associations */}
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.9rem',
          color: 'var(--gold)',
          marginBottom: 'var(--space-lg)',
          letterSpacing: '0.02em',
        }}>
          {associations.join(', ')}
        </div>

        {/* Spread section */}
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.65rem',
          color: 'var(--faded)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: 'var(--space-sm)',
        }}>
          Spread
        </div>

        <SpreadBar score={spreadDisplay} interpretation={spreadInterp} />

        {/* Conventionality section */}
        <div style={{
          marginTop: 'var(--space-lg)',
          paddingTop: 'var(--space-md)',
          borderTop: '1px solid var(--border)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 'var(--space-sm)',
            marginBottom: 'var(--space-xs)',
          }}>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.65rem',
              color: 'var(--faded)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              Conventionality:
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
              color: conventionality.level === 'Low' ? 'var(--active)' :
                     conventionality.level === 'High' ? 'var(--alert)' : 'var(--gold)',
            }}>
              {conventionality.level}
            </span>
          </div>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.85rem',
            color: 'var(--faded)',
            margin: 0,
            lineHeight: 1.5,
          }}>
            {conventionality.description}
          </p>
        </div>

        {/* AI Interpretation section */}
        {hasHaikuData && (
          <div style={{
            marginTop: 'var(--space-lg)',
            paddingTop: 'var(--space-md)',
            borderTop: '1px solid var(--border)',
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.65rem',
              color: 'var(--faded)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: 'var(--space-sm)',
            }}>
              AI Interpretation
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--space-sm)',
            }}>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '1rem',
                color: haikuGuessedCorrectly ? 'var(--active)' : 'var(--alert)',
              }}>
                {haikuGuessedCorrectly ? '✓' : '✗'}
              </span>
              <div>
                <p style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.85rem',
                  color: 'var(--text-light)',
                  margin: 0,
                  marginBottom: 'var(--space-xs)',
                }}>
                  {haikuGuessedCorrectly
                    ? `Haiku guessed "${game.seed_word}" from your associations`
                    : `Haiku couldn't guess "${game.seed_word}" from your associations`}
                </p>
                {otherGuesses.length > 0 && (
                  <p style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    color: 'var(--faded)',
                    margin: 0,
                  }}>
                    (Also considered: {otherGuesses.join(', ')})
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Share section */}
        <div style={{
          marginTop: 'var(--space-lg)',
          paddingTop: 'var(--space-md)',
          borderTop: '1px solid var(--border)',
        }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.65rem',
            color: 'var(--faded)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: 'var(--space-sm)',
          }}>
            Test a Friend
          </div>

          {!shareUrl ? (
            <Button
              variant="secondary"
              onClick={handleCreateShareLink}
              disabled={isCreatingShare}
              style={{ fontSize: '0.75rem' }}
            >
              {isCreatingShare ? 'Creating...' : 'Can they guess your word?'}
            </Button>
          ) : (
            <ShareLinkBox url={shareUrl} />
          )}

          {shareError && (
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.65rem',
              color: 'var(--alert)',
              marginTop: 'var(--space-xs)',
            }}>
              {shareError}
            </div>
          )}
        </div>
      </Panel>

      <Panel
        className=""
        style={{
          borderColor: isRegistered ? 'var(--active)' : 'var(--gold)',
          background: isRegistered
            ? 'linear-gradient(to bottom, var(--card-bg), rgba(85, 176, 120, 0.05))'
            : 'linear-gradient(to bottom, var(--card-bg), rgba(176, 141, 85, 0.05))',
        }}
      >
        <div className="panel-header" style={{ borderBottomColor: isRegistered ? 'var(--active)' : 'var(--gold-dim)' }}>
          <span className="panel-title" style={{ color: isRegistered ? 'var(--active)' : 'var(--gold)' }}>
            {isRegistered ? 'Registered Record' : 'Unregistered Record'}
          </span>
          <span className="panel-meta">
            Session ID: #{game.game_id?.slice(0, 4).toUpperCase() || '----'}
          </span>
        </div>
        <div className="panel-content">
          {isRegistered ? (
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
                  Linked to {user?.email}
                </p>
                <p
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.65rem',
                    color: 'var(--faded)',
                    margin: 0,
                  }}
                >
                  This session is saved to your cognitive profile.
                </p>
              </div>
            </div>
          ) : (
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
          )}
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
        <div>© 2026 Phronos.org</div>
      </footer>

      <MagicLinkModal isOpen={showInitModal} onClose={() => setShowInitModal(false)} />
    </div>
  );
};
