/**
 * Bridging Results Screen - INS-001.2 V2
 *
 * Shows full results including:
 * - Your Union (user's concepts + relevance/spread metrics)
 * - How Others See This Union (Haiku, Statistical, Human)
 *
 * Metrics:
 * - Relevance: How connected clues are to anchor+target (0-100, bootstrapped percentile)
 * - Spread: How spread out the clues are (0-100, DAT-style, using published norms)
 */

import React, { useState } from 'react';
import { useBridgingSenderState } from '../../../lib/bridging-state';
import { Panel } from '../../ui/Panel';
import { Button } from '../../ui/Button';
import { ShareLinkBox } from '../../ui/ShareLinkBox';
import { api } from '../../../lib/api';
import type { BridgingGameResponse } from '../../../lib/api';

interface BridgingResultsScreenProps {
  game: BridgingGameResponse;
}

// 2x2 interpretation based on relevance and spread
function getInterpretation(relevance: number, spread: number): { label: string; description: string } {
  // relevance is 0-100 (displayed as percentage), spread is 0-100 (DAT scale)
  const highRelevance = relevance >= 30;  // 0.30 threshold * 100
  const highSpread = spread >= 85;        // DAT "above average" (75-80 is average per Olson et al.)

  if (highRelevance && highSpread) {
    return {
      label: 'Creative union',
      description: 'Your concepts cover wide semantic territory while staying connected to both endpoints.',
    };
  } else if (highRelevance && !highSpread) {
    return {
      label: 'Focused union',
      description: 'Your concepts form a tight, coherent cluster connecting the endpoints.',
    };
  } else if (!highRelevance && highSpread) {
    return {
      label: 'Drifting',
      description: 'Your concepts spread widely but connect weakly to the endpoints.',
    };
  } else {
    return {
      label: 'Weak union',
      description: "Your concepts cluster together but don't connect strongly to either endpoint.",
    };
  }
}

// Get spread interpretation using DAT norms (Olson et al., 2021, PNAS)
// < 50: poor, 65-90: common range, 75-80: average, 95+: very high
function getSpreadInterpretation(spread: number): string {
  if (spread < 50) {
    return 'low · concepts are very similar';
  } else if (spread < 75) {
    return 'below average · DAT avg: 75-80';
  } else if (spread < 85) {
    return 'average · DAT avg: 75-80';
  } else if (spread < 95) {
    return 'above average · DAT avg: 75-80';
  } else {
    return 'high · wide semantic coverage';
  }
}

// Get relevance interpretation based on percentile (if available) or raw score
function getRelevanceInterpretation(relevance: number, percentile?: number): string {
  if (percentile != null) {
    // Format percentile with proper suffix
    const pct = Math.round(percentile);
    const suffix = pct === 1 ? 'st' : pct === 2 ? 'nd' : pct === 3 ? 'rd' : 'th';

    if (percentile >= 90) {
      return `${pct}${suffix} percentile vs random · exceptional`;
    } else if (percentile >= 75) {
      return `${pct}${suffix} percentile vs random · strong`;
    } else if (percentile >= 50) {
      return `${pct}${suffix} percentile vs random · above average`;
    } else if (percentile >= 25) {
      return `${pct}${suffix} percentile vs random · below average`;
    } else {
      return `${pct}${suffix} percentile vs random · weak`;
    }
  }

  // Fallback to raw score interpretation (when percentile not available)
  if (relevance < 15) {
    return 'noise · not connected to endpoints';
  } else if (relevance < 30) {
    return 'weak · tangential connection';
  } else if (relevance < 45) {
    return 'moderate · connected to endpoints';
  } else {
    return 'strong · core semantic neighborhood';
  }
}

function ScoreBar({
  score,
  leftLabel,
  rightLabel,
  color = 'var(--gold)',
  dimmed = false,
}: {
  score: number;
  leftLabel: string;
  rightLabel: string;
  color?: string;
  dimmed?: boolean;
}) {
  const opacity = dimmed ? 0.4 : 1;
  return (
    <div style={{ opacity }}>
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
            background: color,
            height: '100%',
            width: `${Math.min(100, score)}%`,
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
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}

function Divider() {
  return (
    <div
      style={{
        borderTop: '1px dashed var(--border)',
        margin: 'var(--space-md) 0',
      }}
    />
  );
}

export const BridgingResultsScreen: React.FC<BridgingResultsScreenProps> = ({
  game,
}) => {
  const { dispatch } = useBridgingSenderState();
  const [shareUrl, setShareUrl] = useState<string | null>(
    game.share_code ? `${window.location.origin}/ins-001-2/join/${game.share_code}` : null
  );
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  // New metrics (with fallback to old field names for backwards compatibility)
  const relevance = game.relevance ?? game.binding_score ?? 0;
  const relevancePercentile = game.relevance_percentile;
  const spread = game.divergence ?? game.divergence_score ?? 0;

  // Convert relevance from 0-1 to 0-100 for display if it's in the new format
  const relevanceDisplay = relevance <= 1 ? relevance * 100 : relevance;

  const interpretation = getInterpretation(relevanceDisplay, spread);

  // Dim spread when relevance is below threshold (spread is meaningless without relevance)
  const lowRelevance = relevanceDisplay < 15;

  // V2 fields - check for Haiku's union
  const haikuClues = game.haiku_clues;
  const haikuRelevance = game.haiku_relevance ?? game.haiku_binding;
  const haikuSpread = game.haiku_divergence;
  const hasHaikuUnion = haikuClues && haikuClues.length > 0;

  // Lexical union (statistical baseline)
  const lexicalUnion = game.lexical_bridge;
  const lexicalRelevance = game.lexical_relevance;
  const lexicalSpread = game.lexical_divergence ?? game.lexical_similarity;
  const hasLexicalUnion = lexicalUnion && lexicalUnion.length > 0;

  // Human recipient union (V2)
  const recipientClues = game.recipient_clues;
  const recipientRelevance = game.recipient_relevance ?? game.recipient_binding;
  const recipientSpread = game.recipient_divergence;
  const hasHumanUnion = recipientClues && recipientClues.length > 0;

  // Comparison: is participant more creative than baseline?
  const moreCreativeThanHaiku = hasHaikuUnion && haikuSpread !== undefined && spread > haikuSpread;
  const moreCreativeThanLexical = hasLexicalUnion && lexicalSpread !== undefined && spread > lexicalSpread;

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
      <h1 className="title">Union Analysis</h1>

      {/* Panel 1: Your Union */}
      <Panel style={{ marginBottom: 'var(--space-md)' }}>
        {/* Anchor-Target display */}
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.9rem',
            color: 'var(--gold)',
            textAlign: 'center',
            marginBottom: 'var(--space-md)',
          }}
        >
          {game.anchor_word} ←―――――――――――――――――――――――――――――――→ {game.target_word}
        </div>

        {/* Your Union */}
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.7rem',
            color: 'var(--text-light)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 'var(--space-xs)',
          }}
        >
          Your Union
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
            color: 'var(--text-light)',
            marginBottom: 'var(--space-md)',
          }}
        >
          {game.clues?.join(' · ')}
        </div>

        {/* Interpretation */}
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.7rem',
            color: 'var(--gold)',
            marginBottom: 'var(--space-xs)',
          }}
        >
          {interpretation.label}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.65rem',
            color: 'var(--faded)',
            marginBottom: 'var(--space-md)',
          }}
        >
          {interpretation.description}
        </div>

        {/* Relevance metric */}
        <div style={{ marginBottom: 'var(--space-md)' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 'var(--space-xs)',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
                color: 'var(--text-light)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Relevance
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                color: 'var(--gold)',
              }}
            >
              {Math.round(relevanceDisplay)}
            </span>
          </div>
          <ScoreBar score={relevanceDisplay} leftLabel="noise" rightLabel="strong" />
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6rem',
              color: 'var(--faded)',
              marginTop: 'var(--space-xs)',
            }}
          >
            {getRelevanceInterpretation(relevanceDisplay, relevancePercentile)}
          </div>
        </div>

        {/* Spread metric - dimmed when relevance is low */}
        <div style={{ opacity: lowRelevance ? 0.4 : 1 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              marginBottom: 'var(--space-xs)',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
                color: 'var(--text-light)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Spread
              {lowRelevance && (
                <span style={{ color: 'var(--faded)', marginLeft: 'var(--space-xs)', textTransform: 'none' }}>
                  (relevance too low)
                </span>
              )}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                color: 'var(--gold)',
              }}
            >
              {Math.round(spread)}
            </span>
          </div>
          <ScoreBar score={spread} leftLabel="clustered" rightLabel="spread" />
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6rem',
              color: 'var(--faded)',
              marginTop: 'var(--space-xs)',
            }}
          >
            {getSpreadInterpretation(spread)}
            {!lowRelevance && spread >= 85 && (
              <span style={{ color: 'var(--gold)' }}> · impressive for a bridging task</span>
            )}
          </div>
        </div>
      </Panel>

      {/* Panel 2: How Others See This Union */}
      <Panel style={{ marginBottom: 'var(--space-md)' }}>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.7rem',
            color: 'var(--faded)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 'var(--space-md)',
          }}
        >
          How Others See This Union
        </div>

        {/* Haiku */}
        {hasHaikuUnion && (
          <>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
                color: 'var(--text-light)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 'var(--space-xs)',
              }}
            >
              Haiku
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                color: 'var(--text-light)',
                marginBottom: 'var(--space-xs)',
              }}
            >
              {haikuClues.join(' · ')}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.65rem',
                color: 'var(--faded)',
              }}
            >
              {haikuRelevance !== undefined && (
                <span>relevance: {Math.round(haikuRelevance <= 1 ? haikuRelevance * 100 : haikuRelevance)}</span>
              )}
              {haikuSpread !== undefined && (
                <span> · spread: {Math.round(haikuSpread)}</span>
              )}
              {moreCreativeThanHaiku && (
                <span style={{ color: 'var(--gold)' }}> · you're more creative</span>
              )}
            </div>
            <Divider />
          </>
        )}

        {/* Statistical (Lexical Union) */}
        {hasLexicalUnion && (
          <>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
                color: 'var(--text-light)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 'var(--space-xs)',
              }}
            >
              Statistical
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                color: 'var(--text-light)',
                marginBottom: 'var(--space-xs)',
              }}
            >
              {lexicalUnion.join(' · ')}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.65rem',
                color: 'var(--faded)',
              }}
            >
              {lexicalRelevance != null && (
                <span>relevance: {Math.round(lexicalRelevance <= 1 ? lexicalRelevance * 100 : lexicalRelevance)}</span>
              )}
              {lexicalSpread != null && (
                <span>{lexicalRelevance != null ? ' · ' : ''}spread: {Math.round(lexicalSpread)}</span>
              )}
              {moreCreativeThanLexical && (
                <span style={{ color: 'var(--gold)' }}> · you're more creative</span>
              )}
            </div>
            <Divider />
          </>
        )}

        {/* Human */}
        {hasHumanUnion ? (
          <>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
                color: 'var(--text-light)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 'var(--space-xs)',
              }}
            >
              Human
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                color: 'var(--text-light)',
                marginBottom: 'var(--space-xs)',
              }}
            >
              {recipientClues.join(' · ')}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.65rem',
                color: 'var(--faded)',
              }}
            >
              {recipientRelevance !== undefined && (
                <span>relevance: {Math.round(recipientRelevance <= 1 ? recipientRelevance * 100 : recipientRelevance)}</span>
              )}
              {recipientSpread !== undefined && (
                <span> · spread: {Math.round(recipientSpread)}</span>
              )}
            </div>
          </>
        ) : (
          <div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
                color: 'var(--text-light)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 'var(--space-xs)',
              }}
            >
              Human
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                color: 'var(--faded)',
                marginBottom: 'var(--space-sm)',
              }}
            >
              Share with a friend to compare unions
            </div>

            {shareUrl ? (
              <ShareLinkBox url={shareUrl} />
            ) : (
              <Button
                variant="secondary"
                onClick={handleCreateShareLink}
                disabled={isCreatingShare}
                style={{
                  fontSize: '0.75rem',
                  padding: 'var(--space-xs) var(--space-sm)',
                }}
              >
                {isCreatingShare ? 'Creating...' : 'Create Share Link'}
              </Button>
            )}

            {shareError && (
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.7rem',
                  color: 'var(--alert)',
                  marginTop: 'var(--space-xs)',
                }}
              >
                {shareError}
              </div>
            )}
          </div>
        )}
      </Panel>

      <div className="btn-group">
        <Button variant="primary" onClick={() => dispatch({ type: 'RESET' })}>
          Build Another Union
        </Button>
      </div>
    </div>
  );
};
