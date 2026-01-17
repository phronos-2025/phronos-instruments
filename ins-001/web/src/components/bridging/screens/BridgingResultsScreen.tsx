/**
 * Bridging Results Screen - INS-001.2 V2 (Connected Dot Plot)
 *
 * Shows full results as a connected dot plot visualization:
 * - Each row shows concepts above, with relevance (filled) and spread (hollow) dots
 * - Connecting line shows the gap between metrics
 * - Human row allows sharing to compare with a friend
 *
 * Metrics:
 * - Relevance: How connected concepts are to anchor+target (0-100)
 * - Spread: How spread out the concepts are (0-100, DAT-style)
 */

import React, { useState } from 'react';
import { useBridgingSenderState } from '../../../lib/bridging-state';
import { useAuth } from '../../auth/AuthProvider';
import { Panel } from '../../ui/Panel';
import { Button } from '../../ui/Button';
import { ShareLinkBox } from '../../ui/ShareLinkBox';
import { MagicLinkModal } from '../../auth/MagicLinkModal';
import { api } from '../../../lib/api';
import type { BridgingGameResponse } from '../../../lib/api';

// Morphological variant detection (mirrors backend logic)
function getWordStem(word: string): string {
  word = word.toLowerCase();
  const suffixes = [
    'ically', 'ation', 'ness', 'ment', 'able', 'ible', 'tion',
    'sion', 'ally', 'ful', 'less', 'ing', 'ity', 'ous', 'ive',
    'est', 'ier', 'ies', 'ied', 'ly', 'ed', 'er', 'en', 'es', 's'
  ];
  for (const suffix of suffixes) {
    if (word.endsWith(suffix) && word.length > suffix.length + 2) {
      return word.slice(0, -suffix.length);
    }
  }
  return word;
}

function normalizeStem(word: string): string {
  // Normalize stem for Y→I transformations (mystery/mysteries/mysterious/mysteriously)
  // Uses limited recursion for compound suffixes like "-ously" = "-ous" + "-ly"
  let stem = getWordStem(word.toLowerCase());

  // Second pass: handle compound suffixes (e.g., mysteriously -> mysterious -> mysteri)
  // Only do one more pass to avoid over-stemming (myster -> myst)
  const secondStem = getWordStem(stem);
  // Only accept second stemming if it ends in 'i' (indicating y→i transformation)
  if (secondStem.endsWith('i')) {
    stem = secondStem;
  }

  // Normalize y/i endings for comparison
  if (stem.endsWith('y')) return stem.slice(0, -1);
  if (stem.endsWith('i')) return stem.slice(0, -1);
  return stem;
}

function stripCommonPrefixes(word: string): string {
  // Strip common morphological prefixes (un-, dis-, im-, etc.)
  word = word.toLowerCase();
  const prefixes = [
    'counter', 'under', 'over', 'anti', 'dis', 'mis', 'non',
    'pre', 'un', 'in', 'im', 're'
  ];
  for (const prefix of prefixes) {
    if (word.startsWith(prefix) && word.length > prefix.length + 3) {
      return word.slice(prefix.length);
    }
  }
  return word;
}

function isMorphologicalVariant(word1: string, word2: string): boolean {
  const w1 = word1.toLowerCase();
  const w2 = word2.toLowerCase();

  // Exact match
  if (w1 === w2) return true;

  // One is substring of the other (catches most plurals/verb forms)
  if (w1.startsWith(w2) || w2.startsWith(w1)) {
    if (Math.abs(w1.length - w2.length) <= 4) {
      return true;
    }
  }

  // Get prefix-stripped versions
  const w1Stripped = stripCommonPrefixes(w1);
  const w2Stripped = stripCommonPrefixes(w2);

  // Check prefix-based variants (certainty/uncertainty)
  if (w1Stripped === w2Stripped) return true;
  if (w1Stripped === w2 || w2Stripped === w1) return true;

  // Get normalized stems for all versions
  const stem1 = normalizeStem(w1);
  const stem2 = normalizeStem(w2);
  const stem1Stripped = normalizeStem(w1Stripped);
  const stem2Stripped = normalizeStem(w2Stripped);

  // Same normalized stem (handles y→i transformations like mystery/mysteries/mysterious)
  if (stem1 === stem2) return true;

  // Check normalized stems of prefix-stripped versions
  if (stem1Stripped === stem2Stripped) return true;

  // Cross-check: stripped version matches other's stem (uncertain vs certainty)
  if (w1Stripped === stem2 || w2Stripped === stem1) return true;
  if (stem1Stripped === stem2 || stem2Stripped === stem1) return true;

  // Check if one stripped version is substring of the other (within length limit)
  if (w1Stripped.startsWith(w2Stripped) || w2Stripped.startsWith(w1Stripped)) {
    if (Math.abs(w1Stripped.length - w2Stripped.length) <= 4) {
      return true;
    }
  }

  return false;
}

interface BridgingResultsScreenProps {
  game: BridgingGameResponse;
}

interface DotPlotRowProps {
  label: string;
  concepts: string[];
  relevance: number;
  spread: number;
  isYou?: boolean;
  anchorWord?: string;
  targetWord?: string;
}

// Single row in the connected dot plot
function DotPlotRow({ label, concepts, relevance, spread, isYou, anchorWord, targetWord }: DotPlotRowProps) {
  const scale = (val: number) => Math.min(100, Math.max(0, val));

  // Check if a concept is morphologically similar to anchor or target
  const isMorphologicallySimilarToSeeds = (concept: string): boolean => {
    if (!anchorWord && !targetWord) return false;
    if (anchorWord && isMorphologicalVariant(concept, anchorWord)) return true;
    if (targetWord && isMorphologicalVariant(concept, targetWord)) return true;
    return false;
  };

  return (
    <div className="dot-plot-row" style={{ marginBottom: 'var(--space-lg)' }}>
      {/* Concepts above the track - aligned with track using axis-scale class */}
      <div
        className="dot-plot-concepts dot-plot-axis-scale"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
          color: isYou ? 'var(--gold)' : 'var(--text-light)',
          marginBottom: 'var(--space-xs)',
          letterSpacing: '0.02em',
          textAlign: 'center',
        }}
      >
        {concepts.map((concept, idx) => {
          const hasWarning = isMorphologicallySimilarToSeeds(concept);
          return (
            <span key={idx}>
              {idx > 0 && ' · '}
              <span style={hasWarning ? { color: 'var(--gold)', opacity: 0.6 } : undefined}>
                {concept}
                {hasWarning && ' ⚠'}
              </span>
            </span>
          );
        })}
      </div>

      {/* Row with label, track, and delta */}
      <div className="dot-plot-track-row" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
        {/* Label */}
        <div
          className="dot-plot-label"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.65rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: isYou ? 'var(--gold)' : 'var(--text-light)',
            flexShrink: 0,
          }}
        >
          {label}
        </div>

        {/* Track */}
        <div
          className="dot-plot-track"
          style={{
            flex: 1,
            minWidth: 0,
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
    <div className="dot-plot-row" style={{ marginBottom: 'var(--space-lg)' }}>
      {/* Placeholder concepts - aligned with track using axis-scale class */}
      <div
        className="dot-plot-concepts dot-plot-axis-scale"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
          color: 'var(--faded)',
          marginBottom: 'var(--space-xs)',
          letterSpacing: '0.02em',
          fontStyle: 'italic',
          textAlign: 'center',
        }}
      >
        compare your concepts
      </div>

      {/* Row with label, track placeholder, and share button */}
      <div className="dot-plot-track-row" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
        {/* Label */}
        <div
          className="dot-plot-label"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.65rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: 'var(--text-light)',
            flexShrink: 0,
          }}
        >
          Human
        </div>

        {/* Track placeholder with dashed line */}
        <div
          className="dot-plot-track"
          style={{
            flex: 1,
            minWidth: 0,
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
              borderTop: '1px dashed var(--border)',
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
          }}
        >
          {shareError}
        </div>
      )}
    </div>
  );
}

// Human row with actual data (when recipient has played)
function HumanDataRow({
  concepts,
  relevance,
  spread,
  anchorWord,
  targetWord,
}: {
  concepts: string[];
  relevance: number;
  spread: number;
  anchorWord?: string;
  targetWord?: string;
}) {
  return (
    <DotPlotRow
      label="Human"
      concepts={concepts}
      relevance={relevance}
      spread={spread}
      anchorWord={anchorWord}
      targetWord={targetWord}
    />
  );
}

export const BridgingResultsScreen: React.FC<BridgingResultsScreenProps> = ({
  game,
}) => {
  const { dispatch } = useBridgingSenderState();
  const { user } = useAuth();
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [showInitModal, setShowInitModal] = useState(false);

  // Check if user is registered (has email and not anonymous)
  const isRegistered = user?.email && !user?.is_anonymous;

  // Metrics (with fallback to old field names)
  const relevance = game.relevance ?? game.binding_score ?? 0;
  const spread = game.divergence ?? game.divergence_score ?? 0;
  const relevanceDisplay = relevance <= 1 ? relevance * 100 : relevance;

  // Haiku data
  const haikuClues = game.haiku_clues;
  const haikuRelevance = game.haiku_relevance ?? game.haiku_binding;
  const haikuSpread = game.haiku_divergence;
  const hasHaikuUnion = haikuClues && haikuClues.length > 0;

  // Lexical/Statistical data
  const lexicalUnion = game.lexical_bridge;
  const lexicalRelevance = game.lexical_relevance;
  const lexicalSpread = game.lexical_divergence ?? game.lexical_similarity;
  const hasLexicalUnion = lexicalUnion && lexicalUnion.length > 0;

  // Human recipient data
  const recipientClues = game.recipient_clues;
  const recipientRelevance = game.recipient_relevance ?? game.recipient_binding;
  const recipientSpread = game.recipient_divergence;
  const hasHumanUnion = recipientClues && recipientClues.length > 0;

  const handleCreateShareLink = async () => {
    setIsCreatingShare(true);
    setShareError(null);
    try {
      const response = await api.bridging.createShare(game.game_id);
      setShareUrl(response.share_url);
    } catch (err) {
      setShareError(err instanceof Error ? err.message : 'Failed to create share link');
    } finally {
      setIsCreatingShare(false);
    }
  };

  return (
    <div>
      <p className="subtitle">
        <span className="id">INS-001.2</span> · Your Results
      </p>
      <h1 className="title">Common Ground Analysis</h1>

      <Panel>
        {/* Semantic axis - aligned with track (using axis-scale class for margin) */}
        <div
          className="dot-plot-axis-scale"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
            color: 'var(--gold)',
            textAlign: 'center',
            marginBottom: 'var(--space-lg)',
          }}
        >
          {game.anchor_word} ←―――――――――――――――――――――→ {game.target_word}
        </div>

        {/* Legend - aligned with track (using axis-scale class for margin) */}
        <div
          className="dot-plot-axis-scale"
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

        {/* Axis scale */}
        <div className="dot-plot-axis-scale" style={{ marginBottom: 'var(--space-sm)' }}>
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

        {/* Data rows */}
        <div style={{ marginTop: 'var(--space-md)' }}>
          {/* Your row */}
          <DotPlotRow
            label="You"
            concepts={game.clues || []}
            relevance={relevanceDisplay}
            spread={spread}
            isYou
          />

          {/* Haiku row */}
          {hasHaikuUnion && haikuRelevance !== undefined && haikuSpread !== undefined && (
            <DotPlotRow
              label="Haiku"
              concepts={haikuClues}
              relevance={haikuRelevance <= 1 ? haikuRelevance * 100 : haikuRelevance}
              spread={haikuSpread}
              anchorWord={game.anchor_word}
              targetWord={game.target_word}
            />
          )}

          {/* Statistical row */}
          {hasLexicalUnion && lexicalRelevance != null && lexicalSpread != null && (
            <DotPlotRow
              label="Statistical"
              concepts={lexicalUnion}
              relevance={lexicalRelevance <= 1 ? lexicalRelevance * 100 : lexicalRelevance}
              spread={lexicalSpread}
              anchorWord={game.anchor_word}
              targetWord={game.target_word}
            />
          )}

          {/* Human row */}
          {hasHumanUnion && recipientRelevance !== undefined && recipientSpread !== undefined ? (
            <HumanDataRow
              concepts={recipientClues}
              relevance={recipientRelevance <= 1 ? recipientRelevance * 100 : recipientRelevance}
              spread={recipientSpread}
              anchorWord={game.anchor_word}
              targetWord={game.target_word}
            />
          ) : (
            <HumanShareRow
              shareUrl={shareUrl}
              isCreatingShare={isCreatingShare}
              shareError={shareError}
              onCreateShare={handleCreateShareLink}
            />
          )}
        </div>
      </Panel>

      {/* Interpretation Panel */}
      <Panel
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
          {(() => {
            const userRel = Math.round(relevanceDisplay);
            const userSpread = Math.round(spread);
            const haikuRel = hasHaikuUnion && haikuRelevance !== undefined
              ? Math.round(haikuRelevance <= 1 ? haikuRelevance * 100 : haikuRelevance)
              : null;
            const haikuSpr = hasHaikuUnion && haikuSpread !== undefined ? Math.round(haikuSpread) : null;
            const statRel = hasLexicalUnion && lexicalRelevance != null
              ? Math.round(lexicalRelevance <= 1 ? lexicalRelevance * 100 : lexicalRelevance)
              : null;
            const statSpr = hasLexicalUnion && lexicalSpread != null ? Math.round(lexicalSpread) : null;

            // Helper to compare values (within 5 points = "on par")
            const compare = (user: number, baseline: number | null, name: string) => {
              if (baseline === null) return null;
              const diff = user - baseline;
              if (Math.abs(diff) <= 5) return `on par with ${name}`;
              return diff > 0 ? `higher than ${name}` : `lower than ${name}`;
            };

            // Build relevance comparison
            const haikuRelComp = compare(userRel, haikuRel, 'Haiku');
            const statRelComp = compare(userRel, statRel, 'the statistical model');

            let relevanceStatement = `Your relevance (${userRel}) is `;
            if (haikuRelComp && statRelComp) {
              relevanceStatement += `${haikuRelComp}, and ${statRelComp}.`;
            } else if (haikuRelComp) {
              relevanceStatement += `${haikuRelComp}.`;
            } else if (statRelComp) {
              relevanceStatement += `${statRelComp}.`;
            } else {
              relevanceStatement = `Your relevance is ${userRel}.`;
            }

            // Build spread comparison
            const haikuSprComp = compare(userSpread, haikuSpr, 'Haiku');
            const statSprComp = compare(userSpread, statSpr, 'the statistical model');

            let spreadStatement = ` Your spread (${userSpread}) is `;
            if (haikuSprComp && statSprComp) {
              spreadStatement += `${haikuSprComp}, and ${statSprComp}`;
            } else if (haikuSprComp) {
              spreadStatement += `${haikuSprComp}`;
            } else if (statSprComp) {
              spreadStatement += `${statSprComp}`;
            } else {
              spreadStatement = ` Your spread is ${userSpread}`;
            }

            // Add qualitative insight
            let insight = '';
            if (userSpread > (haikuSpr ?? 50) && userSpread > (statSpr ?? 50)) {
              insight = ', which may indicate your concepts are more diverse but less focused on the semantic bridge between anchor and target.';
            } else if (userRel > (haikuRel ?? 50) && userRel > (statRel ?? 50)) {
              insight = ', suggesting strong conceptual bridging between the anchor and target.';
            } else if (userRel < (haikuRel ?? 50) && userRel < (statRel ?? 50)) {
              insight = '. The bridging concepts may be too distant from the semantic space between anchor and target.';
            } else {
              insight = '.';
            }

            return relevanceStatement + spreadStatement + insight;
          })()}
        </div>
      </Panel>

      {/* Registration Status Panel */}
      <Panel style={{ borderColor: 'var(--gold)', background: 'linear-gradient(to bottom, var(--card-bg), rgba(176, 141, 85, 0.05))', marginTop: 'var(--space-md)' }}>
        <div className="panel-header" style={{ borderBottomColor: 'var(--gold-dim)' }}>
          <span className="panel-title" style={{ color: 'var(--gold)' }}>
            {isRegistered ? 'Registered Record' : 'Unregistered Record'}
          </span>
          <span className="panel-meta">Session ID: #{game.game_id?.slice(0, 4).toUpperCase() || '----'}</span>
        </div>
        <div className="panel-content">
          <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-light)', marginBottom: 'var(--space-xs)' }}>
                {isRegistered
                  ? `Linked to ${user?.email}`
                  : 'Save your scores to your permanent cognitive profile.'}
              </p>
            </div>

            {!isRegistered && (
              <Button
                variant="primary"
                style={{ fontSize: '0.65rem', padding: '10px 20px' }}
                onClick={() => setShowInitModal(true)}
              >
                Initialize ID
              </Button>
            )}
          </div>
        </div>
      </Panel>

      <div className="btn-group" style={{ marginTop: 'var(--space-md)' }}>
        <Button variant="primary" onClick={() => dispatch({ type: 'RESET' })}>
          Find More Common Ground
        </Button>
      </div>

      <MagicLinkModal
        isOpen={showInitModal}
        onClose={() => setShowInitModal(false)}
      />
    </div>
  );
};
