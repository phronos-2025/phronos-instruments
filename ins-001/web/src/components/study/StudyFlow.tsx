/**
 * StudyFlow — Main orchestrator for the study experience (v3).
 *
 * Handles loading, auth detection, resume logic, and routes to the
 * appropriate screen based on study state. Supports both generative
 * and evaluative items.
 */

import React, { useEffect } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { StudyProvider, useStudy } from '../../lib/study-state';
import { api } from '../../lib/api';

import { StudyLandingScreen } from './screens/StudyLandingScreen';
import { StudyConsentScreen } from './screens/StudyConsentScreen';
import { StudyAccountScreen } from './screens/StudyAccountScreen';
import { StudySurveyScreen } from './screens/StudySurveyScreen';
import { StudyGameInstructions } from './screens/StudyGameInstructions';
import { StudyGamePlay } from './screens/StudyGamePlay';
import { StudyScoreReveal } from './screens/StudyScoreReveal';
import { EvaluativeInstructions } from './screens/EvaluativeInstructions';
import { AlignmentRankingPlay } from './screens/AlignmentRankingPlay';
import { ParsimonyLOOPlay } from './screens/ParsimonyLOOPlay';
import { PeerRatingPlay } from './screens/PeerRatingPlay';
import { EvaluativeFeedback } from './screens/EvaluativeFeedback';
import { OptionalBreakScreen } from './screens/OptionalBreakScreen';
import { StudyComplete } from './screens/StudyComplete';

function StudyFlowInner() {
  const { state, dispatch } = useStudy();
  const { user, loading: authLoading } = useAuth();

  // Load study metadata
  useEffect(() => {
    async function load() {
      try {
        const study = await api.studies.get(state.slug);
        dispatch({ type: 'STUDY_LOADED', study });
      } catch (e) {
        dispatch({ type: 'ERROR', message: 'Study not found' });
      }
    }
    load();
  }, [state.slug]);

  // After study loads + auth resolves, check for resume
  useEffect(() => {
    if (!state.study || authLoading) return;
    if (!user) return;

    async function checkResume() {
      try {
        const progress = await api.studies.getProgress(state.slug);
        dispatch({ type: 'RESUME', progress });
      } catch {
        // Not enrolled yet — stay on landing
      }
    }
    checkResume();
  }, [state.study, user, authLoading]);

  // Fetch next item when entering game_instructions with no current item
  useEffect(() => {
    if (state.screen === 'game_instructions' && !state.currentItem) {
      async function fetchNext() {
        try {
          const item = await api.studies.nextItem(state.slug);
          dispatch({ type: 'ITEM_READY', item });
        } catch (e: any) {
          if (e.message?.includes('All items completed') || e.message?.includes('All games completed')) {
            dispatch({ type: 'GO_TO', screen: 'post_survey' });
          } else {
            dispatch({ type: 'ERROR', message: e.message || 'Failed to load item' });
          }
        }
      }
      fetchNext();
    }
  }, [state.screen, state.currentItem]);

  // Render screen
  switch (state.screen) {
    case 'loading':
      return (
        <div className="study-loading">
          <p className="loading-text">Loading study...</p>
        </div>
      );

    case 'landing':
      return <StudyLandingScreen />;

    case 'consent':
      return <StudyConsentScreen />;

    case 'account':
      return <StudyAccountScreen />;

    case 'pre_survey':
      return <StudySurveyScreen timing="pre" />;

    case 'game_instructions':
      if (!state.currentItem) {
        return (
          <div className="study-loading">
            <p className="loading-text">Preparing item {state.itemsCompleted + 1}...</p>
          </div>
        );
      }
      return <StudyGameInstructions />;

    case 'game_playing':
      if (!state.currentItem) return null;
      return <StudyGamePlay />;

    case 'game_score_reveal':
      if (!state.currentScore) return null;
      return <StudyScoreReveal />;

    case 'evaluative_instructions':
      if (!state.currentItem) return null;
      return <EvaluativeInstructions />;

    case 'evaluative_playing':
      if (!state.currentItem) return null;
      return <EvaluativePlayRouter />;

    case 'evaluative_feedback':
      if (!state.currentEvaluation) return null;
      return <EvaluativeFeedback />;

    case 'optional_break':
      return <OptionalBreakScreen />;

    case 'post_survey':
      return <StudySurveyScreen timing="post" />;

    case 'complete':
      return <StudyComplete />;

    case 'error':
      return (
        <div className="study-error">
          <h2>Something went wrong</h2>
          <p>{state.error}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      );

    default:
      return null;
  }
}

/** Routes to the correct evaluative play component based on task type */
function EvaluativePlayRouter() {
  const { state } = useStudy();
  const task = state.currentItem?.config.task;

  switch (task) {
    case 'alignment_ranking':
      return <AlignmentRankingPlay />;
    case 'parsimony_loo':
      return <ParsimonyLOOPlay />;
    case 'peer_rating':
      return <PeerRatingPlay />;
    default:
      return <div className="study-error"><p>Unknown evaluative task: {task}</p></div>;
  }
}

export function StudyFlow({ slug }: { slug: string }) {
  return (
    <StudyProvider slug={slug}>
      <StudyFlowInner />
    </StudyProvider>
  );
}
