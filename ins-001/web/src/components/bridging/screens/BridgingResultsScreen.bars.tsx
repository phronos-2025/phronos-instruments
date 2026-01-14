/**
 * Bridging Results Screen - INS-001.2 V2 (BARS VARIANT)
 *
 * ARCHIVED: This is the original bar-based visualization.
 * The main BridgingResultsScreen now uses a connected-dot-plot design.
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

// Unified metric display component for consistent visualization
function MetricDisplay({
  label,
  score,
  leftLabel,
  rightLabel,
  compact = false,
  highlight,
}: {
  label: string;
  score: number;
  leftLabel: string;
  rightLabel: string;
  compact?: boolean;
  highlight?: string;
}) {
  const barHeight = compact ? '20px' : '24px';

  return (
    <div style={{ marginBottom: compact ? 'var(--space-sm)' : 'var(--space-md)' }}>
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
            fontSize: compact ? '0.65rem' : '0.7rem',
            color: 'var(--text-light)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: compact ? '0.7rem' : '0.75rem',
            color: 'var(--gold)',
          }}
        >
          {Math.round(score)}
        </span>
      </div>
      <div
        style={{
          position: 'relative',
          background: 'linear-gradient(to right, rgba(176, 141, 85, 0.15), rgba(176, 141, 85, 0.05))',
          borderRadius: '4px',
          height: barHeight,
          overflow: 'hidden',
        }}
      >
        {/* Filled portion */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            background: 'var(--gold)',
            height: '100%',
            width: `${Math.min(100, score)}%`,
            transition: 'width 0.3s ease',
          }}
        />
        {/* Scale labels inside bar */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            height: '100%',
            padding: '0 8px',
            fontFamily: 'var(--font-mono)',
            fontSize: compact ? '0.55rem' : '0.6rem',
            textTransform: 'lowercase',
            letterSpacing: '0.02em',
          }}
        >
          <span style={{ color: 'var(--faded)', zIndex: 1 }}>{leftLabel}</span>
          <span style={{ color: 'var(--faded)', zIndex: 1 }}>{rightLabel}</span>
        </div>
      </div>
      {highlight && (
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.6rem',
            color: 'var(--gold)',
            marginTop: 'var(--space-xs)',
          }}
        >
          {highlight}
        </div>
      )}
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

export const BridgingResultsScreenBars: React.FC<BridgingResultsScreenProps> = ({
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
  const spread = game.divergence ?? game.divergence_score ?? 0;

  // Convert relevance from 0-1 to 0-100 for display if it's in the new format
  const relevanceDisplay = relevance <= 1 ? relevance * 100 : relevance;

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
      <h1 className="title">Common Ground Analysis</h1>

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
            textAlign: 'center',
          }}
        >
          Your Common Ground
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
            color: 'var(--text-light)',
            marginBottom: 'var(--space-md)',
            textAlign: 'center',
          }}
        >
          {game.clues?.join(' · ')}
        </div>

        {/* Relevance metric */}
        <MetricDisplay
          label="Relevance"
          score={relevanceDisplay}
          leftLabel="noise"
          rightLabel="strong"
        />

        {/* Spread metric */}
        <MetricDisplay
          label="Spread"
          score={spread}
          leftLabel="clustered"
          rightLabel="spread"
        />
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
          How Others See This Common Ground
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
                textAlign: 'center',
              }}
            >
              Haiku
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                color: 'var(--text-light)',
                marginBottom: 'var(--space-sm)',
                textAlign: 'center',
              }}
            >
              {haikuClues.join(' · ')}
            </div>
            {haikuRelevance !== undefined && (
              <MetricDisplay
                label="Relevance"
                score={haikuRelevance <= 1 ? haikuRelevance * 100 : haikuRelevance}
                leftLabel="noise"
                rightLabel="strong"
                compact
              />
            )}
            {haikuSpread !== undefined && (
              <MetricDisplay
                label="Spread"
                score={haikuSpread}
                leftLabel="clustered"
                rightLabel="spread"
                compact
                highlight={moreCreativeThanHaiku ? 'your spread is higher' : undefined}
              />
            )}
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
                textAlign: 'center',
              }}
            >
              Statistical
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                color: 'var(--text-light)',
                marginBottom: 'var(--space-sm)',
                textAlign: 'center',
              }}
            >
              {lexicalUnion.join(' · ')}
            </div>
            {lexicalRelevance != null && (
              <MetricDisplay
                label="Relevance"
                score={lexicalRelevance <= 1 ? lexicalRelevance * 100 : lexicalRelevance}
                leftLabel="noise"
                rightLabel="strong"
                compact
              />
            )}
            {lexicalSpread != null && (
              <MetricDisplay
                label="Spread"
                score={lexicalSpread}
                leftLabel="clustered"
                rightLabel="spread"
                compact
                highlight={moreCreativeThanLexical ? 'your spread is higher' : undefined}
              />
            )}
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
                textAlign: 'center',
              }}
            >
              Human
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                color: 'var(--text-light)',
                marginBottom: 'var(--space-sm)',
                textAlign: 'center',
              }}
            >
              {recipientClues.join(' · ')}
            </div>
            {recipientRelevance !== undefined && (
              <MetricDisplay
                label="Relevance"
                score={recipientRelevance <= 1 ? recipientRelevance * 100 : recipientRelevance}
                leftLabel="noise"
                rightLabel="strong"
                compact
              />
            )}
            {recipientSpread !== undefined && (
              <MetricDisplay
                label="Spread"
                score={recipientSpread}
                leftLabel="clustered"
                rightLabel="spread"
                compact
              />
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center' }}>
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
              Share with a friend to compare common ground
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
          Find More Common Ground
        </Button>
      </div>
    </div>
  );
};
