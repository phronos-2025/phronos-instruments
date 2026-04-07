/**
 * Group Dashboard — Public aggregate results for a study.
 * Designed for projection (1920×1080) and sharing via link.
 */

import React, { useState, useEffect, lazy, Suspense } from 'react';
import { api, type GroupResultsResponse } from '../../lib/api';

const CohortDistributions = lazy(() => import('../dashboard/group/CohortDistributions').then(m => ({ default: m.CohortDistributions })));
const DivAlignScatterAll = lazy(() => import('../dashboard/group/DivAlignScatterAll').then(m => ({ default: m.DivAlignScatterAll })));
const ConstraintEffects = lazy(() => import('../dashboard/group/ConstraintEffects').then(m => ({ default: m.ConstraintEffects })));
const LearningCurveAll = lazy(() => import('../dashboard/group/LearningCurveAll').then(m => ({ default: m.LearningCurveAll })));
const ValidationPanels = lazy(() => import('../dashboard/group/ValidationPanels').then(m => ({ default: m.ValidationPanels })));
const FeedbackSummary = lazy(() => import('../dashboard/group/FeedbackSummary').then(m => ({ default: m.FeedbackSummary })));
const JoinCTA = lazy(() => import('../dashboard/group/JoinCTA').then(m => ({ default: m.JoinCTA })));

interface GroupDashboardProps {
  slug: string;
}

function formatDateRange(range: { first: string; last: string } | null): string {
  if (!range) return '';
  try {
    const first = new Date(range.first);
    const last = new Date(range.last);
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    const fmtFull = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    if (first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear()) {
      return fmt(first);
    }
    return `${fmtFull(first)} – ${fmtFull(last)}`;
  } catch {
    return '';
  }
}

function ThresholdMessage({ message }: { message: string }) {
  return (
    <div style={{
      border: '1px solid var(--faded-light)',
      background: 'var(--card-bg)',
      padding: '2rem',
      textAlign: 'center',
      fontFamily: 'var(--font-mono)',
      fontSize: '0.8rem',
      color: 'var(--faded)',
    }}>
      {message}
    </div>
  );
}

export function GroupDashboard({ slug }: GroupDashboardProps) {
  const [data, setData] = useState<GroupResultsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const result = await api.studies.getGroupResults(slug);
        setData(result);
      } catch (e: any) {
        setError(e.message || 'Failed to load results');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [slug]);

  if (loading) {
    return (
      <div style={containerStyle}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--faded)', textAlign: 'center', padding: '4rem 0' }}>
          Loading study data...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={containerStyle}>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--alert, #ff6b6b)', textAlign: 'center', padding: '4rem 0' }}>
          {error || 'Study not found'}
        </p>
      </div>
    );
  }

  const dateStr = formatDateRange(data.date_range);
  const insufficientForAll = data.participant_count < 5;

  return (
    <div style={containerStyle}>
      {/* Header */}
      <header style={{ marginBottom: '3rem' }}>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.65rem',
          textTransform: 'uppercase',
          letterSpacing: '2px',
          color: 'var(--gold)',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <span style={{ width: '24px', height: '1px', background: 'var(--gold)', display: 'inline-block' }} />
          Group Results
        </div>
        <h1 style={{
          fontFamily: 'var(--font-serif)',
          fontWeight: 300,
          fontSize: 'clamp(2rem, 5vw, 3rem)',
          letterSpacing: '-0.02em',
          color: 'var(--text-light)',
          marginBottom: '1rem',
          lineHeight: 1.15,
        }}>
          {data.study_title}
        </h1>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.8rem',
          color: 'var(--faded)',
        }}>
          N = {data.participant_count} participants{dateStr ? `  ·  ${dateStr}` : ''}{`  ·  instruments.phronos.org`}
        </div>
      </header>

      {insufficientForAll ? (
        <ThresholdMessage message={`Data collection in progress. Results will appear when enough participants have completed the study. Currently ${data.participant_count} of 5 completed.`} />
      ) : (
        <Suspense fallback={null}>
          {/* Section 2: Cohort Distributions */}
          <section style={sectionStyle}>
            {data.cohort_distributions ? (
              <CohortDistributions
                distributions={data.cohort_distributions}
                participantCount={data.participant_count}
              />
            ) : (
              <ThresholdMessage message="Cohort distributions require more participants." />
            )}
          </section>

          {/* Section 3: Scatterplot */}
          <section style={sectionStyle}>
            {data.scatterplot_data && data.scatterplot_data.length > 0 ? (
              <DivAlignScatterAll data={data.scatterplot_data} />
            ) : (
              <ThresholdMessage message="Scatterplot data not yet available." />
            )}
          </section>

          {/* Section 4: Constraint Effects */}
          <section style={sectionStyle}>
            {data.constraint_effects ? (
              <ConstraintEffects effects={data.constraint_effects} />
            ) : (
              <ThresholdMessage message="Constraint effect comparison requires data from both Item 4 and Item 8." />
            )}
          </section>

          {/* Section 5: Learning Curve */}
          <section style={sectionStyle}>
            {data.learning_curve ? (
              <LearningCurveAll data={data.learning_curve} />
            ) : (
              <ThresholdMessage message="Learning curve requires 10+ full battery completions." />
            )}
          </section>

          {/* Section 7: Validation Panels */}
          <section style={sectionStyle}>
            {data.validation ? (
              <ValidationPanels validation={data.validation} />
            ) : (
              <ThresholdMessage message="Validation results will appear with 10+ participants." />
            )}
          </section>

          {/* Section 8: Participant Feedback */}
          <section style={sectionStyle}>
            {data.feedback ? (
              <FeedbackSummary feedback={data.feedback} />
            ) : (
              <ThresholdMessage message="Participant feedback will appear with 5+ post-survey responses." />
            )}
          </section>

          {/* Section 9: Join CTA + Footer */}
          <section style={{ borderTop: '1px solid var(--faded-light)', marginTop: '2rem' }}>
            <JoinCTA slug={slug} isActive={true} />
          </section>
        </Suspense>
      )}
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  maxWidth: '1100px',
  margin: '0 auto',
  padding: '2rem 1.5rem 4rem',
};

const sectionStyle: React.CSSProperties = {
  borderTop: '1px solid var(--faded-light)',
  paddingTop: '2.5rem',
  marginBottom: '2.5rem',
};
