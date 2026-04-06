/**
 * Study State Machine (v3)
 *
 * Manages the flow: landing → consent → account → pre_survey →
 *   item_loop (generative + evaluative) → optional_break → post_survey → complete
 */

import React, { createContext, useContext, useReducer, type ReactNode } from 'react';
import type {
  StudyResponse,
  StudyNextItemResponse,
  StudyGameScoreResponse,
  StudyEvaluationScoreResponse,
  StudyProgressResponse,
} from './api';

// ============================================
// STATE
// ============================================

export type StudyScreen =
  | 'loading'
  | 'landing'
  | 'consent'
  | 'account'
  | 'pre_survey'
  | 'game_instructions'
  | 'game_playing'
  | 'game_score_reveal'
  | 'evaluative_instructions'
  | 'evaluative_playing'
  | 'evaluative_feedback'
  | 'optional_break'
  | 'post_survey'
  | 'complete'
  | 'error';

export interface StudyState {
  screen: StudyScreen;
  slug: string;
  study: StudyResponse | null;
  enrollmentId: number | null;

  // v3: item-based tracking (backwards compat: gamesCompleted/totalGames still available)
  itemsCompleted: number;
  totalItems: number;
  gamesCompleted: number;   // kept for backwards compat
  totalGames: number;       // kept for backwards compat

  // Current item (generative or evaluative)
  currentItem: StudyNextItemResponse | null;
  currentGame: StudyNextItemResponse | null; // alias for backwards compat
  currentScore: StudyGameScoreResponse | null;
  currentEvaluation: StudyEvaluationScoreResponse | null;
  allScores: StudyGameScoreResponse[];
  allEvaluations: StudyEvaluationScoreResponse[];

  // v3: optional break
  optedPartial: boolean | null;
  optionalBreakAfterItem: number | null;
  showBreak: boolean;

  error: string | null;
  metricsExplained: Set<string>;
}

export const initialState = (slug: string): StudyState => ({
  screen: 'loading',
  slug,
  study: null,
  enrollmentId: null,
  itemsCompleted: 0,
  totalItems: 0,
  gamesCompleted: 0,
  totalGames: 0,
  currentItem: null,
  currentGame: null,
  currentScore: null,
  currentEvaluation: null,
  allScores: [],
  allEvaluations: [],
  optedPartial: null,
  optionalBreakAfterItem: null,
  showBreak: false,
  error: null,
  metricsExplained: new Set(),
});

// ============================================
// ACTIONS
// ============================================

export type StudyAction =
  | { type: 'STUDY_LOADED'; study: StudyResponse }
  | { type: 'ENROLLED'; enrollmentId: number; itemsCompleted: number }
  | { type: 'RESUME'; progress: StudyProgressResponse }
  | { type: 'GO_TO'; screen: StudyScreen }
  // v3: unified item flow
  | { type: 'ITEM_READY'; item: StudyNextItemResponse }
  | { type: 'GAME_STARTED' }
  | { type: 'GAME_SCORED'; score: StudyGameScoreResponse }
  | { type: 'EVALUATIVE_STARTED' }
  | { type: 'EVALUATION_SCORED'; result: StudyEvaluationScoreResponse }
  | { type: 'NEXT_ITEM' }
  | { type: 'SHOW_BREAK' }
  | { type: 'BREAK_CHOICE'; partial: boolean }
  // Legacy aliases
  | { type: 'GAME_READY'; game: StudyNextItemResponse }
  | { type: 'NEXT_GAME' }
  // Shared
  | { type: 'METRIC_EXPLAINED'; metric: string }
  | { type: 'ERROR'; message: string };

// ============================================
// HELPERS
// ============================================

function isEvaluative(item: StudyNextItemResponse): boolean {
  return item.config.type === 'evaluative';
}

function resolveResumeScreen(p: StudyProgressResponse): StudyScreen {
  if (p.completed_at) return 'complete';
  if (p.post_survey_done) return 'complete';

  const items = p.items_completed ?? p.games_completed;
  const total = p.total_items ?? p.total_games;

  if (items >= total) return 'post_survey';
  if (p.pre_survey_done && p.consented_at) return 'game_instructions'; // Will trigger next-item fetch
  if (p.consented_at && !p.pre_survey_done) return 'pre_survey';
  if (p.enrollment_id) return 'consent';
  return 'landing';
}

// ============================================
// REDUCER
// ============================================

export function studyReducer(state: StudyState, action: StudyAction): StudyState {
  switch (action.type) {
    case 'STUDY_LOADED':
      return {
        ...state,
        study: action.study,
        totalItems: action.study.game_count,
        totalGames: action.study.game_count,
        screen: 'landing',
      };

    case 'ENROLLED':
      return {
        ...state,
        enrollmentId: action.enrollmentId,
        itemsCompleted: action.itemsCompleted,
        gamesCompleted: action.itemsCompleted,
      };

    case 'RESUME': {
      const p = action.progress;
      const items = p.items_completed ?? p.games_completed;
      const total = p.total_items ?? p.total_games;
      const screen = resolveResumeScreen(p);

      return {
        ...state,
        enrollmentId: p.enrollment_id,
        itemsCompleted: items,
        gamesCompleted: items,
        totalItems: total,
        totalGames: total,
        optedPartial: p.opted_partial ?? null,
        allScores: p.game_scores.map(g => ({
          game_id: g.game_id,
          game_number: g.game_number ?? g.item_number,
          item_number: g.item_number ?? g.game_number,
          game_type: g.game_type,
          scores: g.scores as Record<string, number | boolean>,
          percentiles: null,
          exact_match: null,
          insufficient_data: true,
        })),
        allEvaluations: (p.evaluation_scores ?? []).map(e => ({
          item_number: e.item_number,
          task: e.task,
          feedback: e.feedback,
        })),
        screen,
      };
    }

    case 'GO_TO':
      return { ...state, screen: action.screen };

    // v3: unified item ready — routes to generative or evaluative instructions
    case 'ITEM_READY': {
      const item = action.item;
      const isEval = isEvaluative(item);

      // Check if we should show optional break first
      if (item.show_break && !state.showBreak) {
        return {
          ...state,
          currentItem: item,
          currentGame: item,
          currentScore: null,
          currentEvaluation: null,
          showBreak: true,
          screen: 'optional_break',
        };
      }

      return {
        ...state,
        currentItem: item,
        currentGame: item,
        currentScore: null,
        currentEvaluation: null,
        showBreak: false,
        screen: isEval ? 'evaluative_instructions' : 'game_instructions',
      };
    }

    // Legacy alias
    case 'GAME_READY':
      return studyReducer(state, { type: 'ITEM_READY', item: action.game });

    case 'GAME_STARTED':
      return { ...state, screen: 'game_playing' };

    case 'GAME_SCORED':
      return {
        ...state,
        currentScore: action.score,
        itemsCompleted: state.itemsCompleted + 1,
        gamesCompleted: state.itemsCompleted + 1,
        allScores: [...state.allScores, action.score],
        screen: 'game_score_reveal',
      };

    case 'EVALUATIVE_STARTED':
      return { ...state, screen: 'evaluative_playing' };

    case 'EVALUATION_SCORED':
      return {
        ...state,
        currentEvaluation: action.result,
        itemsCompleted: state.itemsCompleted + 1,
        gamesCompleted: state.itemsCompleted + 1,
        allEvaluations: [...state.allEvaluations, action.result],
        screen: 'evaluative_feedback',
      };

    case 'SHOW_BREAK':
      return { ...state, screen: 'optional_break' };

    case 'BREAK_CHOICE':
      if (action.partial) {
        return {
          ...state,
          optedPartial: true,
          screen: 'post_survey',
          currentItem: null,
          currentGame: null,
        };
      }
      // Continue: fetch next item
      return {
        ...state,
        optedPartial: false,
        showBreak: false,
        screen: 'game_instructions', // will trigger next-item fetch
        currentItem: null,
        currentGame: null,
      };

    case 'NEXT_ITEM':
    case 'NEXT_GAME':
      if (state.itemsCompleted >= state.totalItems) {
        return { ...state, screen: 'post_survey', currentItem: null, currentGame: null, currentScore: null, currentEvaluation: null };
      }
      return { ...state, screen: 'game_instructions', currentItem: null, currentGame: null, currentScore: null, currentEvaluation: null };

    case 'METRIC_EXPLAINED':
      return {
        ...state,
        metricsExplained: new Set([...state.metricsExplained, action.metric]),
      };

    case 'ERROR':
      return { ...state, error: action.message, screen: 'error' };

    default:
      return state;
  }
}

// ============================================
// CONTEXT
// ============================================

interface StudyContextValue {
  state: StudyState;
  dispatch: React.Dispatch<StudyAction>;
}

const StudyContext = createContext<StudyContextValue | null>(null);

export function StudyProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const [state, dispatch] = useReducer(studyReducer, initialState(slug));
  return (
    <StudyContext.Provider value={{ state, dispatch }}>
      {children}
    </StudyContext.Provider>
  );
}

export function useStudy() {
  const ctx = useContext(StudyContext);
  if (!ctx) throw new Error('useStudy must be used within StudyProvider');
  return ctx;
}
