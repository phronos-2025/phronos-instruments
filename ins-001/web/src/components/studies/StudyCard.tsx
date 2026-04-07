import React from 'react';
import type { StudyListItem } from '../../lib/api';
import { StudyBadge } from './StudyBadge';

interface StudyCardProps {
  study: StudyListItem;
  variant: 'landing' | 'profile';
}

export function StudyCard({ study, variant }: StudyCardProps) {
  const isCompleted = study.enrollment?.completed_at != null;
  const isEnrolled = study.enrollment != null;
  const isInProgress = isEnrolled && !isCompleted;

  if (variant === 'profile') {
    return <ProfileStudyCard study={study} isCompleted={isCompleted} isInProgress={isInProgress} />;
  }

  return <LandingStudyCard study={study} isCompleted={isCompleted} isInProgress={isInProgress} />;
}

function LandingStudyCard({
  study,
  isCompleted,
  isInProgress,
}: {
  study: StudyListItem;
  isCompleted: boolean;
  isInProgress: boolean;
}) {
  const cta = isCompleted
    ? { label: 'View Results', href: '/profile#study-results' }
    : isInProgress
      ? { label: 'Continue', href: `/studies/${study.slug}` }
      : { label: 'Join Study', href: `/studies/${study.slug}` };

  return (
    <a href={cta.href} className="study-card study-card--landing">
      <div className="study-card__header">
        <span className="study-card__id">{study.slug.toUpperCase()}</span>
        <StudyBadge status={study.is_active ? 'active' : 'completed'} />
      </div>
      <div className="study-card__body">
        <h3 className="study-card__title">{study.title}</h3>
        {study.description && (
          <p className="study-card__description">{study.description}</p>
        )}
        <div className="study-card__stats">
          <span className="study-card__stat">
            <span className="study-card__stat-label">Duration:</span>{' '}
            <span className="study-card__stat-value">~{Math.round(study.game_count * 1.2)} min</span>
          </span>
          <span className="study-card__stat">
            <span className="study-card__stat-label">Participants:</span>{' '}
            <span className="study-card__stat-value">{study.participant_count}</span>
          </span>
          <span className="study-card__stat">
            <span className="study-card__stat-label">Tasks:</span>{' '}
            <span className="study-card__stat-value">{study.game_count}</span>
          </span>
        </div>
      </div>
      <div className="study-card__footer">
        <span className="study-card__cta">{cta.label}</span>
        <span className="study-card__arrow">&rarr;</span>
      </div>
    </a>
  );
}

function ProfileStudyCard({
  study,
  isCompleted,
  isInProgress,
}: {
  study: StudyListItem;
  isCompleted: boolean;
  isInProgress: boolean;
}) {
  const enrollment = study.enrollment;
  const completedDate = enrollment?.completed_at
    ? new Date(enrollment.completed_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <div className="study-card study-card--profile">
      <div className="study-card__body">
        <div className="study-card__header">
          <h4 className="study-card__title" style={{ fontSize: '1rem', marginBottom: 0 }}>
            {study.title}
          </h4>
          <StudyBadge status={study.is_active ? 'active' : 'completed'} />
        </div>
        <p className="study-card__meta">
          {isCompleted
            ? `Completed ${completedDate}  \u00B7  ${enrollment!.items_completed}/${study.game_count} tasks  \u00B7  N = ${study.participant_count}`
            : isInProgress
              ? `In progress \u2014 ${enrollment!.items_completed}/${study.game_count} tasks completed`
              : `${study.game_count} tasks  \u00B7  N = ${study.participant_count}`}
        </p>
      </div>
      <div className="study-card__footer">
        {isCompleted ? (
          <>
            <a href="/profile#study-results" className="study-card__cta">View Results</a>
            <a href={`/studies/${study.slug}/results`} className="study-card__cta">Group Dashboard</a>
          </>
        ) : isInProgress ? (
          <a href={`/studies/${study.slug}`} className="study-card__cta">Continue &rarr;</a>
        ) : (
          <a href={`/studies/${study.slug}`} className="study-card__cta">Join Study &rarr;</a>
        )}
      </div>
    </div>
  );
}

// Inject styles
const styles = `
  .study-card {
    background: var(--card-bg);
    border: 1px solid var(--faded-light);
    position: relative;
    transition: all 0.2s ease;
    text-decoration: none;
    display: block;
  }

  .study-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image:
      linear-gradient(var(--faded-ultra) 1px, transparent 1px),
      linear-gradient(90deg, var(--faded-ultra) 1px, transparent 1px);
    background-size: 20px 20px;
    pointer-events: none;
    opacity: 0.5;
  }

  .study-card:hover {
    border-color: var(--gold);
    box-shadow: 5px 5px 0px var(--gold-dim);
    transform: translate(-2px, -2px);
  }

  .study-card--landing {
    grid-column: 1 / -1;
  }

  .study-card__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-sm) var(--space-md);
    border-bottom: 1px solid var(--faded-light);
    position: relative;
    z-index: 1;
  }

  .study-card__id {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--gold);
    text-transform: uppercase;
  }

  .study-card__body {
    padding: var(--space-md);
    position: relative;
    z-index: 1;
  }

  .study-card__title {
    font-family: var(--font-serif);
    font-size: 1.5rem;
    font-weight: 400;
    color: var(--text-light);
    margin-bottom: var(--space-xs);
  }

  .study-card__description {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--faded);
    line-height: 1.6;
    margin-bottom: var(--space-md);
  }

  .study-card__meta {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--faded);
    line-height: 1.6;
    margin-top: var(--space-xs);
  }

  .study-card__stats {
    display: flex;
    gap: var(--space-md);
    flex-wrap: wrap;
  }

  .study-card__stat {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
  }

  .study-card__stat-label {
    color: var(--faded);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .study-card__stat-value {
    color: var(--text-light);
  }

  .study-card__footer {
    padding: var(--space-sm) var(--space-md);
    border-top: 1px solid var(--faded-light);
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: relative;
    z-index: 1;
    gap: var(--space-md);
  }

  .study-card__cta {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--gold);
    text-transform: uppercase;
    letter-spacing: 1px;
    text-decoration: none;
  }

  .study-card__arrow {
    color: var(--gold);
    transition: transform 0.2s ease;
  }

  .study-card:hover .study-card__arrow {
    transform: translateX(4px);
  }

  /* Profile variant adjustments */
  .study-card--profile {
    margin-bottom: var(--space-sm);
  }

  .study-card--profile .study-card__header {
    border-bottom: none;
    padding-bottom: 0;
  }
`;

if (typeof document !== 'undefined') {
  const styleId = 'study-card-styles';
  if (!document.getElementById(styleId)) {
    const el = document.createElement('style');
    el.id = styleId;
    el.textContent = styles;
    document.head.appendChild(el);
  }
}
