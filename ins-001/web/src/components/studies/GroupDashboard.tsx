import React, { useState, useEffect } from 'react';
import { api, type StudyResponse } from '../../lib/api';

interface GroupDashboardProps {
  slug: string;
}

export function GroupDashboard({ slug }: GroupDashboardProps) {
  const [study, setStudy] = useState<StudyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await api.studies.get(slug);
        setStudy(data);
      } catch (e: any) {
        setError(e.message || 'Study not found');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="group-dashboard">
        <p className="group-dashboard__loading">Loading study data...</p>
      </div>
    );
  }

  if (error || !study) {
    return (
      <div className="group-dashboard">
        <p className="group-dashboard__error">{error || 'Study not found'}</p>
      </div>
    );
  }

  const insufficientData = study.participant_count < 5;

  return (
    <div className="group-dashboard">
      <div className="group-dashboard__header">
        <span className="group-dashboard__label">
          <span className="group-dashboard__label-line" />
          Group Results
        </span>
        <h1 className="group-dashboard__title">{study.title}</h1>
        {study.description && (
          <p className="group-dashboard__description">{study.description}</p>
        )}
        <div className="group-dashboard__meta">
          <span className="group-dashboard__meta-item">
            <span className="group-dashboard__dot" />
            {study.participant_count} Participants
          </span>
          <span className="group-dashboard__meta-item">
            {study.game_count} Tasks
          </span>
        </div>
      </div>

      {insufficientData ? (
        <div className="group-dashboard__placeholder">
          <div className="group-dashboard__placeholder-inner">
            <h2 className="group-dashboard__placeholder-title">Data Collection in Progress</h2>
            <p className="group-dashboard__placeholder-text">
              Aggregate results will be available once at least 5 participants have completed the study.
              Currently {study.participant_count} of 5 completed.
            </p>
            <div className="group-dashboard__progress-bar">
              <div
                className="group-dashboard__progress-fill"
                style={{ width: `${Math.min(100, (study.participant_count / 5) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="group-dashboard__content">
          <div className="group-dashboard__stats-grid">
            <div className="group-dashboard__stat">
              <span className="group-dashboard__stat-value">{study.participant_count}</span>
              <span className="group-dashboard__stat-label">Participants</span>
            </div>
            <div className="group-dashboard__stat">
              <span className="group-dashboard__stat-value">{study.game_count}</span>
              <span className="group-dashboard__stat-label">Tasks</span>
            </div>
          </div>
        </div>
      )}

      {study.is_active && (
        <div className="group-dashboard__cta-section">
          <a href={`/studies/${slug}`} className="group-dashboard__cta">
            Join Study &rarr;
          </a>
        </div>
      )}
    </div>
  );
}

// Styles
const styles = `
  .group-dashboard {
    font-family: var(--font-mono);
  }

  .group-dashboard__loading,
  .group-dashboard__error {
    font-size: var(--text-sm);
    color: var(--faded);
    text-align: center;
    padding: var(--space-2xl) 0;
  }

  .group-dashboard__error {
    color: var(--alert, #ff6b6b);
  }

  .group-dashboard__header {
    margin-bottom: var(--space-xl);
  }

  .group-dashboard__label {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 2px;
    color: var(--gold);
    margin-bottom: var(--space-md);
    display: flex;
    align-items: center;
    gap: var(--space-xs);
  }

  .group-dashboard__label-line {
    width: 24px;
    height: 1px;
    background: var(--gold);
  }

  .group-dashboard__title {
    font-family: var(--font-serif);
    font-weight: 300;
    font-size: clamp(2rem, 5vw, 2.5rem);
    letter-spacing: -0.02em;
    color: var(--text-light);
    margin-bottom: var(--space-md);
  }

  .group-dashboard__description {
    font-family: var(--font-body);
    font-size: 1.125rem;
    color: var(--faded);
    max-width: 600px;
    line-height: 1.7;
    margin-bottom: var(--space-lg);
  }

  .group-dashboard__meta {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--faded);
    display: flex;
    gap: var(--space-lg);
  }

  .group-dashboard__meta-item {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
  }

  .group-dashboard__dot {
    width: 6px;
    height: 6px;
    background: var(--active);
    border-radius: 50%;
  }

  .group-dashboard__placeholder {
    border: 1px solid var(--faded-light);
    background: var(--card-bg);
    padding: var(--space-xl);
    text-align: center;
    margin-bottom: var(--space-xl);
  }

  .group-dashboard__placeholder-title {
    font-family: var(--font-serif);
    font-weight: 400;
    font-size: 1.25rem;
    color: var(--text-light);
    margin-bottom: var(--space-sm);
  }

  .group-dashboard__placeholder-text {
    font-size: var(--text-sm);
    color: var(--faded);
    line-height: 1.6;
    margin-bottom: var(--space-md);
  }

  .group-dashboard__progress-bar {
    height: 4px;
    background: var(--faded-ultra);
    max-width: 300px;
    margin: 0 auto;
  }

  .group-dashboard__progress-fill {
    height: 100%;
    background: var(--gold);
    transition: width 0.3s ease;
  }

  .group-dashboard__content {
    margin-bottom: var(--space-xl);
  }

  .group-dashboard__stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--space-md);
    margin-bottom: var(--space-xl);
  }

  .group-dashboard__stat {
    background: var(--card-bg);
    border: 1px solid var(--faded-light);
    padding: var(--space-md);
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .group-dashboard__stat-value {
    font-size: 1.5rem;
    color: var(--text-light);
  }

  .group-dashboard__stat-label {
    font-size: var(--text-xs);
    color: var(--faded);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .group-dashboard__cta-section {
    text-align: center;
    padding: var(--space-lg) 0;
    border-top: 1px solid var(--faded-light);
  }

  .group-dashboard__cta {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--bg-deep);
    background: var(--gold);
    border: 1px solid var(--gold);
    padding: var(--space-sm) var(--space-lg);
    text-decoration: none;
    transition: all 0.2s ease;
    display: inline-block;
  }

  .group-dashboard__cta:hover {
    box-shadow: 5px 5px 0px var(--gold-dim);
    transform: translate(-2px, -2px);
  }
`;

if (typeof document !== 'undefined') {
  const styleId = 'group-dashboard-styles';
  if (!document.getElementById(styleId)) {
    const el = document.createElement('style');
    el.id = styleId;
    el.textContent = styles;
    document.head.appendChild(el);
  }
}
