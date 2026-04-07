/**
 * Peer Feedback Card
 *
 * Displays peer ratings (difference, connection, uniqueness) for the user's
 * item 3 submission, alongside the computed metric scores.
 */

import React from 'react';
import { METRIC_COLORS } from '../../lib/chart-config';

interface PeerFeedback {
  game_id: string;
  item_number: number;
  rating_count: number;
  mean_difference: number;
  mean_connection: number;
  mean_uniqueness: number;
}

interface Props {
  feedback: PeerFeedback;
}

const DIMENSIONS = [
  { key: 'mean_difference', label: 'How different?', color: METRIC_COLORS.divergence },
  { key: 'mean_connection', label: 'How connected?', color: METRIC_COLORS.alignment },
  { key: 'mean_uniqueness', label: 'How unique?', color: METRIC_COLORS.parsimony },
] as const;

export function PeerFeedbackCard({ feedback }: Props) {
  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 'var(--space-sm)',
      }}>
        <p style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.65rem',
          color: 'var(--faded)',
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}>
          Peer Feedback
        </p>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.55rem',
          color: 'var(--faded)',
          opacity: 0.7,
        }}>
          {feedback.rating_count} ratings
        </span>
      </div>

      <p style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.6rem',
        color: 'var(--faded)',
        marginBottom: 'var(--space-md)',
        opacity: 0.7,
      }}>
        Other participants rated your Item {feedback.item_number} response:
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
        {DIMENSIONS.map(({ key, label, color }) => {
          const value = feedback[key as keyof PeerFeedback] as number;
          return (
            <div key={key} style={{
              display: 'grid',
              gridTemplateColumns: '110px 1fr 50px',
              alignItems: 'center',
              gap: 'var(--space-xs)',
            }}>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.6rem',
                color: 'var(--faded)',
              }}>
                {label}
              </span>

              <div style={{
                height: '6px',
                background: 'var(--faded-light)',
                borderRadius: '1px',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${(value / 5) * 100}%`,
                  background: color,
                  transition: 'width 0.5s ease',
                }} />
              </div>

              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
                color,
                textAlign: 'right',
              }}>
                {value.toFixed(1)} / 5
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
