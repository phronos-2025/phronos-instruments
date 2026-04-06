/**
 * Study Survey Screen
 *
 * Generic survey renderer for pre and post surveys.
 * Renders Likert scales, categorical options, and free text.
 */

import React, { useState, useEffect } from 'react';
import { useStudy } from '../../../lib/study-state';
import { api, type SurveyItem } from '../../../lib/api';
import { Panel } from '../../ui/Panel';
import { Button } from '../../ui/Button';

interface Props {
  timing: 'pre' | 'post';
}

export function StudySurveyScreen({ timing }: Props) {
  const { state, dispatch } = useStudy();
  const [items, setItems] = useState<SurveyItem[]>([]);
  const [responses, setResponses] = useState<Record<string, string | number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadSurvey() {
      try {
        const result = await api.studies.getSurveyItems(state.slug, timing);
        setItems(result.items);
      } catch (e: any) {
        dispatch({ type: 'ERROR', message: `Failed to load survey: ${e.message}` });
      } finally {
        setLoading(false);
      }
    }
    loadSurvey();
  }, [timing]);

  const setResponse = (itemId: string, value: string | number) => {
    setResponses(prev => ({ ...prev, [itemId]: value }));
  };

  const allAnswered = items.every(item => {
    if (item.type === 'text') return true; // Text is optional (except free_text is optional)
    return responses[item.id] !== undefined;
  });

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const formatted = Object.entries(responses).map(([item_id, value]) => ({ item_id, value }));
      await api.studies.submitSurvey(state.slug, timing, formatted);

      if (timing === 'pre') {
        dispatch({ type: 'GO_TO', screen: 'game_instructions' });
      } else {
        dispatch({ type: 'GO_TO', screen: 'complete' });
      }
    } catch (e: any) {
      dispatch({ type: 'ERROR', message: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="study-loading"><p className="loading-text">Loading survey...</p></div>;
  }

  return (
    <div className="study-container">
      <h2 className="title" style={{ fontSize: '1.8rem' }}>
        {timing === 'pre' ? 'Before We Begin' : 'Final Questions'}
      </h2>
      <p className="description" style={{ maxWidth: '500px', margin: '0 auto var(--space-lg)' }}>
        {timing === 'pre'
          ? 'A few questions about your background. This takes about a minute.'
          : 'A few questions about your experience. Almost done!'}
      </p>

      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        {items.map((item, idx) => (
          <Panel key={item.id} style={{ marginBottom: 'var(--space-md)' }}>
            <p style={{
              fontFamily: 'var(--font-body)',
              fontSize: '0.85rem',
              color: 'var(--text-light)',
              marginBottom: 'var(--space-sm)',
              lineHeight: 1.6,
            }}>
              {idx + 1}. {item.text}
            </p>

            {(item.type === 'likert' || item.type === 'categorical') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {(item.labels || item.options || []).map((label, i) => (
                  <label
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-xs)',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.7rem',
                      color: responses[item.id] === (item.type === 'likert' ? i + 1 : label)
                        ? 'var(--gold)' : 'var(--faded)',
                      padding: '4px 0',
                    }}
                  >
                    <input
                      type="radio"
                      name={item.id}
                      checked={responses[item.id] === (item.type === 'likert' ? i + 1 : label)}
                      onChange={() => setResponse(item.id, item.type === 'likert' ? i + 1 : label)}
                      style={{ accentColor: 'var(--gold)' }}
                    />
                    {label}
                  </label>
                ))}
              </div>
            )}

            {item.type === 'text' && (
              <textarea
                value={(responses[item.id] as string) || ''}
                onChange={(e) => setResponse(item.id, e.target.value)}
                placeholder={item.id === 'free_text' ? 'Optional' : ''}
                rows={item.id === 'free_text' ? 4 : 1}
                style={{
                  width: '100%',
                  padding: 'var(--space-sm)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--faded-light)',
                  color: 'var(--text-light)',
                  resize: 'vertical',
                }}
              />
            )}
          </Panel>
        ))}

        <div className="btn-group" style={{ textAlign: 'center', marginTop: 'var(--space-md)' }}>
          <Button variant="primary" onClick={handleSubmit} disabled={!allAnswered || submitting}>
            {submitting ? 'Submitting...' : timing === 'pre' ? 'Start Games' : 'See Your Results'}
          </Button>
        </div>
      </div>
    </div>
  );
}
