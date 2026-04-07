/**
 * Feedback Summary — Post-survey Likert results and free-text quotes.
 * Shows mean score per item with small distribution bars.
 */

import React from 'react';

interface FeedbackItem {
  label: string;
  key: string;
  mean: number;
  distribution: number[];
  n: number;
}

interface Props {
  feedback: {
    items: FeedbackItem[];
    quotes: string[];
  };
}

// Short display labels for the post-survey items
const SHORT_LABELS: Record<string, string> = {
  perceived_validity: 'Perceived Validity',
  meta_strategy_adjustment: 'Strategy Adjustment',
  meta_evaluative_clarity: 'Evaluative Clarity',
  creative_self_efficacy_post: 'Creative Self-Efficacy',
  novelty: 'Novelty',
  relevance: 'Relevance',
  likelihood_to_use: 'Would Use',
};

function FeedbackCard({ item }: { item: FeedbackItem }) {
  const total = item.distribution.reduce((a, b) => a + b, 0);
  const maxCount = Math.max(...item.distribution);

  return (
    <div style={{
      background: 'var(--card-bg)',
      border: '1px solid var(--faded-light)',
      padding: '1rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
    }}>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.6rem',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        color: 'var(--faded)',
        lineHeight: 1.3,
      }}>{SHORT_LABELS[item.key] || item.key}</div>
      <div style={{
        fontFamily: 'var(--font-serif)',
        fontSize: '1.75rem',
        color: 'var(--text-light)',
        fontWeight: 300,
      }}>
        {item.mean.toFixed(1)}<span style={{ fontSize: '0.9rem', color: 'var(--faded)' }}>/5</span>
      </div>
      {/* Mini distribution bars */}
      <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', height: '30px' }}>
        {item.distribution.map((count, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: maxCount > 0 ? `${Math.max(4, (count / maxCount) * 30)}px` : '4px',
              background: count > 0 ? 'var(--gold)' : 'var(--faded-ultra)',
              opacity: count > 0 ? 0.6 : 0.3,
              borderRadius: '1px',
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: 'var(--faded)' }}>1</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: 'var(--faded)' }}>5</span>
      </div>
    </div>
  );
}

export function FeedbackSummary({ feedback }: Props) {
  // Show the 4 items from the spec: perceived_validity, novelty, relevance, likelihood_to_use
  const priorityKeys = ['perceived_validity', 'novelty', 'relevance', 'likelihood_to_use'];
  const priorityItems = priorityKeys
    .map(key => feedback.items.find(i => i.key === key))
    .filter(Boolean) as FeedbackItem[];

  // Additional items not in priority list
  const otherItems = feedback.items.filter(i => !priorityKeys.includes(i.key));

  return (
    <div>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.65rem',
        textTransform: 'uppercase' as const,
        letterSpacing: '2px',
        color: 'var(--gold)',
        marginBottom: '1.5rem',
      }}>Participant Feedback</div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${Math.min(priorityItems.length, 4)}, 1fr)`,
        gap: '1rem',
        marginBottom: otherItems.length > 0 ? '1rem' : '0',
      }}>
        {priorityItems.map(item => (
          <FeedbackCard key={item.key} item={item} />
        ))}
      </div>

      {otherItems.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(otherItems.length, 3)}, 1fr)`,
          gap: '1rem',
          marginBottom: '1.5rem',
        }}>
          {otherItems.map(item => (
            <FeedbackCard key={item.key} item={item} />
          ))}
        </div>
      )}

      {feedback.quotes.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.6rem',
            textTransform: 'uppercase' as const,
            letterSpacing: '1px',
            color: 'var(--faded)',
            marginBottom: '0.75rem',
          }}>Selected quotes</div>
          {feedback.quotes.map((q, i) => (
            <p key={i} style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.875rem',
              color: 'var(--faded)',
              fontStyle: 'italic',
              lineHeight: 1.6,
              marginBottom: '0.75rem',
              paddingLeft: '1rem',
              borderLeft: '2px solid var(--faded-light)',
            }}>
              "{q}"
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
