/**
 * Bridging Results Screen - INS-001.2 V4 (Connected Dot Plot)
 *
 * Shows full results as a connected dot plot visualization:
 * - Each row shows concepts above, with fidelity (filled) and spread (hollow) dots
 * - Connecting line shows the gap between metrics
 * - Human row allows sharing to compare with a friend
 *
 * Metrics:
 * - Fidelity: How well clues jointly identify the anchor-target pair (0-100)
 *   Uses joint constraint scoring: coverage (foils eliminated) × efficiency (non-redundancy)
 * - Spread: How spread out the concepts are (0-100, DAT-style)
 *
 * Interpretation:
 * - "Spread: how far apart your clues are from each other"
 * - "Fidelity: how well your clues jointly identify the anchor-target pair"
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
import { InterpretationPanel, MetricRow, ComparisonRow } from '../../ui/InterpretationPanel';
import {
  FIDELITY_INTERPRETATIONS,
  SPREAD_INTERPRETATIONS_001_2,
  SIMILARITY_INTERPRETATIONS,
  METHODOLOGY_NOTES,
  VALIDITY_WARNINGS,
  getFidelityBand,
  getFidelityLabel,
  getSpreadBand001_2,
  getSpreadLabel001_2,
  getSimilarityBand,
  getSimilarityLabel,
  generateSpreadComparison,
  isFidelityValid,
  type FidelityBand,
  type SpreadBand001_2,
  type SimilarityBand,
} from '../../../lib/interpretation';

// Morphological variant detection (mirrors backend logic)
function getWordStem(word: string): string {
  word = word.toLowerCase();
  // Extended suffix list - includes Latin/Greek-derived endings
  const suffixes = [
    // Long compound suffixes (check first)
    'isation', 'ization', 'istically', 'ologically', 'fulness',
    'ically', 'iously', 'ously', 'atively', 'ively', 'ately',
    // Medium suffixes
    'ation', 'ition', 'ution', 'ture', 'ness', 'ment', 'able', 'ible',
    'tion', 'sion', 'ally', 'ical', 'ious', 'eous', 'ance', 'ence',
    'ful', 'less', 'ing', 'ity', 'ous', 'ive', 'ant', 'ent',
    // Short suffixes (check last to avoid over-stripping)
    'est', 'ier', 'ies', 'ied', 'ure', 'ate', 'ism', 'ist',
    'al', 'ar', 'ic', 'ly', 'ed', 'er', 'en', 'es', 'um', 'us', 's'
  ];
  for (const suffix of suffixes) {
    if (word.endsWith(suffix) && word.length > suffix.length + 2) {
      return word.slice(0, -suffix.length);
    }
  }
  return word;
}

function normalizeStem(word: string): string {
  // Normalize stem for Y→I transformations and compound suffixes
  // Handles: mystery/mysteries/mysterious/mysteriously, legislation/legislative/legislature
  let stem = getWordStem(word.toLowerCase());

  // Second pass: handle compound suffixes, but only if:
  // - ends in 'i' (y→i transformation, e.g., mysteri from mysterious)
  // - ends in 'at' (from -ative/-ation compounds, e.g., legislat from legislative)
  const secondStem = getWordStem(stem);
  if (secondStem !== stem) {
    if (secondStem.endsWith('i') || stem.endsWith('at')) {
      stem = secondStem;
      // Third pass for triple compounds (e.g., mysteriously -> mysterious -> mysteri)
      const thirdStem = getWordStem(stem);
      if (thirdStem !== stem && thirdStem.endsWith('i')) {
        stem = thirdStem;
      }
    }
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

function commonPrefixLength(s1: string, s2: string): number {
  // Return the length of the common prefix between two strings
  let i = 0;
  while (i < s1.length && i < s2.length && s1[i] === s2[i]) {
    i++;
  }
  return i;
}

function isMorphologicalVariant(word1: string, word2: string, minCommonPrefix: number = 5): boolean {
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

  // Check if stems share a common prefix of sufficient length
  // This handles Latin root variants like legislation/legislative/legislature
  const commonLen = commonPrefixLength(stem1, stem2);
  const minStemLen = Math.min(stem1.length, stem2.length);

  // If stems share 80%+ of the shorter stem's length (min 5 chars), consider them variants
  if (commonLen >= minCommonPrefix && commonLen >= minStemLen * 0.8) {
    return true;
  }

  // Also check stripped stems
  const commonLenStripped = commonPrefixLength(stem1Stripped, stem2Stripped);
  const minStemLenStripped = Math.min(stem1Stripped.length, stem2Stripped.length);

  if (commonLenStripped >= minCommonPrefix && commonLenStripped >= minStemLenStripped * 0.8) {
    return true;
  }

  return false;
}

// Validity threshold for fidelity (0-1 scale)
// Fidelity < 0.50 means clues don't constrain the solution space well
const FIDELITY_VALIDITY_THRESHOLD = 0.50;

// Local wrapper functions to get human-readable labels (use imported centralized functions)
function getLocalFidelityLabel(fidelity: number): string {
  const band = getFidelityBand(fidelity);
  return getFidelityLabel(band);
}

function getLocalSpreadLabel(spread: number): string {
  const band = getSpreadBand001_2(spread);
  return getSpreadLabel001_2(band);
}

// Structured interpretation result
interface InterpretationResult {
  isValid: boolean;
  validityWarning?: string;
  fidelity: {
    score: number;
    band: FidelityBand;
    label: string;
    observation: string;
    implication: string;
  };
  spread: {
    score: number;
    band: SpreadBand001_2;
    label: string;
    observation: string;
    implication: string;
  };
  humanAiSimilarity?: {
    score: number;
    band: SimilarityBand;
    label: string;
    observation: string;
    implication: string;
  };
  comparisons: {
    haiku?: string;
    statistical?: string;
  };
}

// Generate structured interpretation based on fidelity and spread
function generateStructuredInterpretation(
  participantSpread: number,
  haikuSpread: number | null,
  statisticalSpread: number | null,
  participantFidelity: number,
  haikuBridgeSimilarity: number | null
): InterpretationResult {
  const fidelityDisplay = participantFidelity > 1 ? participantFidelity : participantFidelity * 100;
  const fidelityBand = getFidelityBand(participantFidelity);
  const spreadBand = getSpreadBand001_2(participantSpread);

  const fidelityInterp = FIDELITY_INTERPRETATIONS[fidelityBand];
  const spreadInterp = SPREAD_INTERPRETATIONS_001_2[spreadBand];

  const result: InterpretationResult = {
    isValid: isFidelityValid(participantFidelity),
    fidelity: {
      score: fidelityDisplay,
      band: fidelityBand,
      label: getFidelityLabel(fidelityBand),
      observation: fidelityInterp.observation,
      implication: fidelityInterp.implication,
    },
    spread: {
      score: participantSpread,
      band: spreadBand,
      label: getSpreadLabel001_2(spreadBand),
      observation: spreadInterp.observation,
      implication: spreadInterp.implication,
    },
    comparisons: {},
  };

  // Add validity warning if below threshold
  if (!result.isValid) {
    result.validityWarning = VALIDITY_WARNINGS.fidelity;
  }

  // Human-AI Similarity (if Haiku data available)
  if (haikuBridgeSimilarity !== null) {
    const similarityDisplay = haikuBridgeSimilarity <= 1 ? haikuBridgeSimilarity * 100 : haikuBridgeSimilarity;
    const similarityBand = getSimilarityBand(haikuBridgeSimilarity);
    const similarityInterp = SIMILARITY_INTERPRETATIONS[similarityBand];

    result.humanAiSimilarity = {
      score: similarityDisplay,
      band: similarityBand,
      label: getSimilarityLabel(similarityBand),
      observation: similarityInterp.observation,
      implication: similarityInterp.implication,
    };
  }

  // Haiku comparison
  if (haikuSpread !== null) {
    const comparison = generateSpreadComparison(participantSpread, haikuSpread, 'Haiku');
    result.comparisons.haiku = comparison.text;
  }

  // Statistical comparison
  if (statisticalSpread !== null) {
    const comparison = generateSpreadComparison(participantSpread, statisticalSpread, 'Statistical baseline');
    result.comparisons.statistical = comparison.text;
  }

  return result;
}

// Legacy: Generate plain text interpretation (for backwards compatibility)
function generateInterpretation(
  participantSpread: number,
  haikuSpread: number | null,
  statisticalSpread: number | null,
  participantFidelity: number,
  haikuBridgeSimilarity: number | null = null
): string {
  const result = generateStructuredInterpretation(
    participantSpread,
    haikuSpread,
    statisticalSpread,
    participantFidelity,
    haikuBridgeSimilarity
  );

  if (!result.isValid) {
    return result.validityWarning || VALIDITY_WARNINGS.fidelity;
  }

  const parts: string[] = [];
  parts.push(`Your fidelity (${Math.round(result.fidelity.score)}) is ${result.fidelity.label.toLowerCase()}. ${result.fidelity.observation}`);
  parts.push(`Your spread (${Math.round(result.spread.score)}) is ${result.spread.label.toLowerCase()}. ${result.spread.observation}`);

  if (result.comparisons.haiku) {
    parts.push(result.comparisons.haiku);
  }

  if (result.comparisons.statistical) {
    parts.push(result.comparisons.statistical);
  }

  return parts.join(' ');
}

interface BridgingResultsScreenProps {
  game: BridgingGameResponse;
}

interface DotPlotRowProps {
  label: string;
  concepts: string[];
  fidelity: number;
  spread: number;
  isYou?: boolean;
  anchorWord?: string;
  targetWord?: string;
}

// Single row in the connected dot plot
function DotPlotRow({ label, concepts, fidelity, spread, isYou, anchorWord, targetWord }: DotPlotRowProps) {
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
              left: `${Math.min(scale(fidelity), scale(spread))}%`,
              width: `${Math.abs(scale(spread) - scale(fidelity))}%`,
              top: '50%',
              height: '2px',
              backgroundColor: 'var(--gold)',
              opacity: 0.4,
              transform: 'translateY(-50%)',
            }}
          />

          {/* Fidelity dot (filled) */}
          <div
            style={{
              position: 'absolute',
              left: `${scale(fidelity)}%`,
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
              left: `${scale(fidelity)}%`,
              bottom: '-16px',
              transform: 'translateX(-50%)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6rem',
              color: 'var(--gold)',
            }}
          >
            {Math.round(fidelity)}
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
  fidelity,
  spread,
  anchorWord,
  targetWord,
}: {
  concepts: string[];
  fidelity: number;
  spread: number;
  anchorWord?: string;
  targetWord?: string;
}) {
  return (
    <DotPlotRow
      label="Human"
      concepts={concepts}
      fidelity={fidelity}
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

  // Metrics (with fallback to old field names for backwards compatibility)
  // Fidelity is 0-1, display as 0-100
  const fidelity = game.fidelity ?? game.relevance ?? game.binding_score ?? 0;
  const spread = game.divergence ?? game.divergence_score ?? 0;
  const fidelityDisplay = fidelity <= 1 ? fidelity * 100 : fidelity;

  // Haiku data
  const haikuClues = game.haiku_clues;
  const haikuFidelity = game.haiku_fidelity ?? game.haiku_relevance ?? game.haiku_binding;
  const haikuSpread = game.haiku_divergence;
  const haikuBridgeSimilarity = game.haiku_bridge_similarity;
  const hasHaikuUnion = haikuClues && haikuClues.length > 0;

  // Lexical/Statistical data
  const lexicalUnion = game.lexical_bridge;
  const lexicalFidelity = game.lexical_fidelity ?? game.lexical_relevance;
  const lexicalSpread = game.lexical_divergence ?? game.lexical_similarity;
  const hasLexicalUnion = lexicalUnion && lexicalUnion.length > 0;

  // Human recipient data
  const recipientClues = game.recipient_clues;
  const recipientFidelity = game.recipient_fidelity ?? game.recipient_relevance ?? game.recipient_binding;
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
            <span>Fidelity</span>
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
            fidelity={fidelityDisplay}
            spread={spread}
            isYou
          />

          {/* Haiku row */}
          {hasHaikuUnion && haikuFidelity !== undefined && haikuSpread !== undefined && (
            <DotPlotRow
              label="Haiku"
              concepts={haikuClues}
              fidelity={haikuFidelity <= 1 ? haikuFidelity * 100 : haikuFidelity}
              spread={haikuSpread}
              anchorWord={game.anchor_word}
              targetWord={game.target_word}
            />
          )}

          {/* Statistical row */}
          {hasLexicalUnion && lexicalFidelity != null && lexicalSpread != null && (
            <DotPlotRow
              label="Statistical"
              concepts={lexicalUnion}
              fidelity={lexicalFidelity <= 1 ? lexicalFidelity * 100 : lexicalFidelity}
              spread={lexicalSpread}
              anchorWord={game.anchor_word}
              targetWord={game.target_word}
            />
          )}

          {/* Human row */}
          {hasHumanUnion && recipientFidelity !== undefined && recipientSpread !== undefined ? (
            <HumanDataRow
              concepts={recipientClues}
              fidelity={recipientFidelity <= 1 ? recipientFidelity * 100 : recipientFidelity}
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
      {(() => {
        const interpretation = generateStructuredInterpretation(
          spread,
          hasHaikuUnion && haikuSpread !== undefined ? haikuSpread : null,
          hasLexicalUnion && lexicalSpread != null ? lexicalSpread : null,
          fidelityDisplay,
          hasHaikuUnion && haikuBridgeSimilarity != null ? haikuBridgeSimilarity : null
        );

        return (
          <InterpretationPanel methodsNote={METHODOLOGY_NOTES.ins001_2}>
            {/* Validity warning if below threshold */}
            {!interpretation.isValid && interpretation.validityWarning && (
              <div style={{
                marginBottom: 'var(--space-md)',
                padding: 'var(--space-sm)',
                backgroundColor: 'rgba(204, 85, 68, 0.1)',
                borderLeft: '3px solid var(--alert)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8rem',
                color: 'var(--alert)',
              }}>
                {interpretation.validityWarning}
              </div>
            )}

            {/* Fidelity interpretation */}
            <MetricRow
              label="Fidelity"
              score={interpretation.fidelity.score}
              band={interpretation.fidelity.label}
              observation={interpretation.fidelity.observation}
              implication={interpretation.fidelity.implication}
              color="var(--gold)"
            />

            {/* Spread interpretation */}
            <MetricRow
              label="Spread"
              score={interpretation.spread.score}
              band={interpretation.spread.label}
              observation={interpretation.spread.observation}
              implication={interpretation.spread.implication}
            />

            {/* Human-AI Similarity interpretation */}
            {interpretation.humanAiSimilarity && (
              <MetricRow
                label="Human-AI Similarity"
                score={interpretation.humanAiSimilarity.score}
                band={interpretation.humanAiSimilarity.label}
                observation={interpretation.humanAiSimilarity.observation}
                implication={interpretation.humanAiSimilarity.implication}
              />
            )}

            {/* Baseline comparisons */}
            {interpretation.comparisons.haiku && (
              <ComparisonRow text={interpretation.comparisons.haiku} />
            )}
            {interpretation.comparisons.statistical && (
              <ComparisonRow text={interpretation.comparisons.statistical} />
            )}
          </InterpretationPanel>
        );
      })()}

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
