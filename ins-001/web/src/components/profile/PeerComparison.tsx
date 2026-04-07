/**
 * Peer Comparison Dashboard
 *
 * Shows aggregate percentile cards, scatterplot, per-game scores,
 * and learning curve for completed studies.
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { api, type StudyDashboardResponse } from '../../lib/api';
import { Panel } from '../ui/Panel';
import { PercentileCards } from './PercentileCards';
import { ComparisonChart } from './ComparisonChart';
import { DivAlignScatter } from './DivAlignScatter';
import { PeerFeedbackCard } from './PeerFeedbackCard';
import { GameScoresTable } from './GameScoresTable';
import { LearningCurve } from './LearningCurve';

export function PeerComparison() {
  const { user } = useAuth();
  const [studies, setStudies] = useState<string[]>([]);
  const [selectedStudy, setSelectedStudy] = useState<string>('');
  const [dashboard, setDashboard] = useState<StudyDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check for completed studies
  useEffect(() => {
    if (!user) return;

    async function checkStudies() {
      try {
        const completed = await api.studies.getMyCompletedStudies();
        const slugs = completed.map(s => s.study_slug);
        setStudies(slugs);
        if (slugs.length > 0) {
          setSelectedStudy(slugs[0]);
        }
      } catch {
        // Silently fail — dashboard just won't show
      } finally {
        setLoading(false);
      }
    }

    checkStudies();
  }, [user]);

  // Load dashboard when study selected
  useEffect(() => {
    if (!selectedStudy) return;

    async function loadDashboard() {
      setLoading(true);
      try {
        const data = await api.studies.getDashboard(selectedStudy);
        setDashboard(data);
        setError(null);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [selectedStudy]);

  if (!user || studies.length === 0) {
    return null; // Don't render if no completed studies
  }

  if (loading && !dashboard) {
    return (
      <Panel title="Peer Comparison" meta="Beta">
        <p className="loading-text">Loading dashboard...</p>
      </Panel>
    );
  }

  if (error) {
    return (
      <Panel title="Peer Comparison" meta="Beta">
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--faded)' }}>
          Unable to load dashboard: {error}
        </p>
      </Panel>
    );
  }

  if (!dashboard) return null;

  return (
    <div style={{ marginTop: 'var(--space-lg)' }}>
      <Panel title="Peer Comparison" meta="Beta">
        {/* Study selector */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--space-md)',
        }}>
          {studies.length > 1 ? (
            <select
              value={selectedStudy}
              onChange={(e) => setSelectedStudy(e.target.value)}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
                background: 'var(--card-bg)',
                color: 'var(--text-light)',
                border: '1px solid var(--faded-light)',
                padding: '4px 8px',
              }}
            >
              {studies.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          ) : (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--gold)' }}>
              {dashboard.study_title}
            </span>
          )}
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--faded)' }}>
            N = {dashboard.participant_count} participants
          </span>
        </div>

        {dashboard.insufficient_data ? (
          <div style={{
            textAlign: 'center',
            padding: 'var(--space-lg)',
            border: '1px dashed var(--faded-light)',
          }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--faded)' }}>
              Not enough data yet — check back soon
            </p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--faded)', marginTop: 'var(--space-xs)' }}>
              Percentiles require at least 20 completed participants.
              Currently {dashboard.participant_count} have completed.
            </p>
          </div>
        ) : (
          <>
            {/* Aggregate percentile cards */}
            {dashboard.aggregate_percentiles && (
              <PercentileCards percentiles={dashboard.aggregate_percentiles} />
            )}

            {/* Bridge comparison (first vs last) */}
            {dashboard.comparison_charts?.filter(c => c.label.includes('Bridge')).map(comp => (
              <div key={comp.label} style={{ marginTop: 'var(--space-lg)' }}>
                <ComparisonChart comparison={comp} />
              </div>
            ))}

            {/* Constraint comparison (asymmetric m,n) */}
            {dashboard.comparison_charts?.filter(c => c.label.includes('Asymmetric')).map(comp => (
              <div key={comp.label} style={{ marginTop: 'var(--space-lg)' }}>
                <ComparisonChart comparison={comp} />
              </div>
            ))}

            {/* Scatterplot */}
            {dashboard.scatterplot_data && dashboard.scatterplot_data.length > 0 && (
              <div style={{ marginTop: 'var(--space-lg)' }}>
                <DivAlignScatter data={dashboard.scatterplot_data} />
              </div>
            )}

            {/* Peer feedback */}
            {dashboard.peer_feedback && (
              <div style={{ marginTop: 'var(--space-lg)' }}>
                <PeerFeedbackCard feedback={dashboard.peer_feedback} />
              </div>
            )}
          </>
        )}

        {/* Per-game scores (always show, even without enough data for percentiles) */}
        <div style={{ marginTop: 'var(--space-lg)' }}>
          <GameScoresTable
            games={dashboard.per_game_scores}
            showPercentiles={!dashboard.insufficient_data}
          />
        </div>

        {/* Learning curve */}
        {!dashboard.insufficient_data && dashboard.learning_curve && dashboard.learning_curve.length > 0 && (
          <div style={{ marginTop: 'var(--space-lg)' }}>
            <LearningCurve data={dashboard.learning_curve} />
          </div>
        )}
      </Panel>
    </div>
  );
}
