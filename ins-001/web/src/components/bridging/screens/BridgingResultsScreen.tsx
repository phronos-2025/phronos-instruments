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
import { Panel } from '../../ui/Panel';
import { Button } from '../../ui/Button';
import { ShareLinkBox } from '../../ui/ShareLinkBox';
import { MagicLinkModal } from '../../auth/MagicLinkModal';
import { api } from '../../../lib/api';
import type { BridgingGameResponse } from '../../../lib/api';

interface BridgingResultsScreenProps {
  game: BridgingGameResponse;
}

interface DotPlotRowProps {
  label: string;
  concepts: string[];
  relevance: number;
  spread: number;
  isYou?: boolean;
}

// Single row in the connected dot plot
function DotPlotRow({ label, concepts, relevance, spread, isYou }: DotPlotRowProps) {
  const scale = (val: number) => Math.min(100, Math.max(0, val));

  return (
    <div style={{ marginBottom: 'var(--space-lg)' }}>
      {/* Concepts above the track - offset to align with track, not label */}
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
          color: isYou ? 'var(--gold)' : 'var(--text-light)',
          marginBottom: 'var(--space-xs)',
          letterSpacing: '0.02em',
          textAlign: 'center',
          marginLeft: '92px', // 80px label + 12px gap (--space-sm)
        }}
      >
        {concepts.join(' · ')}
      </div>

      {/* Row with label, track, and delta */}
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
              left: `${scale(relevance)}%`,
              width: `${Math.max(0, scale(spread) - scale(relevance))}%`,
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
          marginLeft: '92px', // 80px label + 12px gap (--space-sm)
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
            marginLeft: '92px', // align with track
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

// Human row with actual data (when recipient has played)
function HumanDataRow({
  concepts,
  relevance,
  spread,
}: {
  concepts: string[];
  relevance: number;
  spread: number;
}) {
  return (
    <DotPlotRow
      label="Human"
      concepts={concepts}
      relevance={relevance}
      spread={spread}
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
  const [showInitModal, setShowInitModal] = useState(false);

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

      <Panel style={{ background: 'var(--bg-deep)' }}>
        {/* Semantic axis */}
        <div
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
            />
          )}

          {/* Statistical row */}
          {hasLexicalUnion && lexicalRelevance != null && lexicalSpread != null && (
            <DotPlotRow
              label="Statistical"
              concepts={lexicalUnion}
              relevance={lexicalRelevance <= 1 ? lexicalRelevance * 100 : lexicalRelevance}
              spread={lexicalSpread}
            />
          )}

          {/* Human row */}
          {hasHumanUnion && recipientRelevance !== undefined && recipientSpread !== undefined ? (
            <HumanDataRow
              concepts={recipientClues}
              relevance={recipientRelevance <= 1 ? recipientRelevance * 100 : recipientRelevance}
              spread={recipientSpread}
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

      {/* Unregistered Record Panel */}
      <Panel style={{ borderColor: 'var(--gold)', background: 'linear-gradient(to bottom, var(--card-bg), rgba(176, 141, 85, 0.05))', marginTop: 'var(--space-md)' }}>
        <div className="panel-header" style={{ borderBottomColor: 'var(--gold-dim)' }}>
          <span className="panel-title" style={{ color: 'var(--gold)' }}>Unregistered Record</span>
          <span className="panel-meta">Session ID: #{game.game_id?.slice(0, 4).toUpperCase() || '----'}</span>
        </div>
        <div className="panel-content">
          <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-light)', marginBottom: 'var(--space-xs)' }}>
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
