/**
 * API Client - INS-001
 * 
 * Typed API client for backend communication
 */

import { supabase } from './supabase';

/**
 * Normalize API URL to ensure it has a protocol.
 * If the URL doesn't start with http:// or https://, prepend https://
 */
function normalizeApiUrl(url: string): string {
  if (!url) return url;
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  // Default to https:// for production URLs
  return `https://${trimmed}`;
}

const rawApiUrl = import.meta.env.PUBLIC_API_URL || 'http://localhost:8000';
const API_URL = normalizeApiUrl(rawApiUrl);

// Types (matching backend models)
export type RecipientType = 'network' | 'stranger' | 'llm';
export type GameStatus = 'pending_clues' | 'pending_guess' | 'completed' | 'expired';

export interface NoiseFloorWord {
  word: string;
  similarity: number;
}

export interface CreateGameRequest {
  seed_word: string;
  seed_word_sense?: string;
  recipient_type: RecipientType;
}

export interface CreateGameResponse {
  game_id: string;
  seed_word: string;
  noise_floor: NoiseFloorWord[];
  status: GameStatus;
  is_polysemous: boolean;
  sense_options?: string[];
  seed_in_vocabulary?: boolean;
}

export interface ClueTiming {
  word: string;
  first_entered_ms: number;
  last_modified_ms: number;
}

export interface SubmitCluesRequest {
  clues: string[];
  clue_timings?: ClueTiming[];
}

export interface SubmitCluesResponse {
  game_id: string;
  clues: string[];
  divergence_score: number;
  status: GameStatus;
  // New unified scoring (matches INS-001.2)
  relevance?: number;  // 0-1 scale: how connected to seed
  spread?: number;     // 0-100 scale: DAT-style divergence
  llm_guesses?: string[];
  convergence_score?: number;
  guess_similarities?: number[];
}

export interface SubmitGuessesRequest {
  guesses: string[];
}

export interface SubmitGuessesResponse {
  game_id: string;
  guesses: string[];
  convergence_score: number;
  exact_match: boolean;
  seed_word: string;
  status: GameStatus;
  guess_similarities?: number[];
}

export interface CreateShareTokenResponse {
  token: string;
  expires_at: string;
  share_url: string;
}

export interface JoinGameResponse {
  game_id: string;
  clues: string[];
  noise_floor: NoiseFloorWord[];
  sender_display_name?: string;
}

export interface GameResponse {
  game_id: string;
  sender_id: string;
  recipient_id?: string;
  recipient_type: RecipientType;
  seed_word: string;
  seed_word_sense?: string;
  seed_in_vocabulary: boolean;
  noise_floor: NoiseFloorWord[];
  clues?: string[];
  guesses?: string[];
  divergence_score?: number;
  convergence_score?: number;
  // New unified scoring (matches INS-001.2)
  relevance?: number;  // 0-1 scale: how connected to seed
  spread?: number;     // 0-100 scale: DAT-style divergence
  guess_similarities?: number[];
  status: GameStatus;
  created_at: string;
  expires_at: string;
}

// ============================================
// INS-001.2: Bridging Types
// ============================================

export type BridgingRecipientType = 'human' | 'haiku';
export type BridgingGameStatus = 'pending_clues' | 'pending_guess' | 'completed' | 'expired';

export interface CreateBridgingGameRequest {
  anchor_word: string;
  target_word: string;
  recipient_type?: BridgingRecipientType;
}

export interface CreateBridgingGameResponse {
  game_id: string;
  anchor_word: string;
  target_word: string;
  status: BridgingGameStatus;
}

export interface SubmitBridgingCluesRequest {
  clues: string[];
  clue_timings?: ClueTiming[];
}

export interface SubmitBridgingCluesResponse {
  game_id: string;
  clues: string[];
  // V4 fidelity scoring (primary metric)
  fidelity: number;  // 0-1: joint constraint score (coverage × efficiency)
  fidelity_percentile?: number;  // 0-100: vs random baseline
  divergence: number;  // 0-100: DAT-style spread
  // Legacy fields (kept for backwards compatibility)
  divergence_score?: number;
  binding_score?: number;  // How well clues relate to both endpoints
  relevance?: number;  // 0-1: mean min(sim_anchor, sim_target)
  relevance_percentile?: number;
  lexical_bridge?: string[];  // Optimal embedding-based path
  lexical_fidelity?: number;
  lexical_similarity?: number;  // Similarity between user clues and lexical union
  lexical_relevance?: number;  // Legacy
  lexical_divergence?: number;
  status: BridgingGameStatus;
  share_code?: string;
  // V2: Haiku builds its own bridge
  haiku_clues?: string[];
  haiku_fidelity?: number;
  haiku_divergence?: number;
  haiku_binding?: number;  // Legacy
  haiku_relevance?: number;  // Legacy
  haiku_bridge_similarity?: number;
  // Legacy (deprecated - for old games)
  haiku_guessed_anchor?: string;
  haiku_guessed_target?: string;
  haiku_reconstruction_score?: number;
}

export interface SuggestWordResponse {
  suggestion: string;
  from_word?: string;
}

export interface CreateBridgingShareResponse {
  share_code: string;
  share_url: string;
}

export interface JoinBridgingGameResponse {
  game_id: string;
  clues: string[];
}

export interface SubmitBridgingGuessRequest {
  guessed_anchor: string;
  guessed_target: string;
}

export interface SubmitBridgingGuessResponse {
  game_id: string;
  guessed_anchor: string;
  guessed_target: string;
  reconstruction_score: number;
  anchor_similarity: number;
  target_similarity: number;
  order_swapped: boolean;
  exact_anchor_match: boolean;
  exact_target_match: boolean;
  true_anchor: string;
  true_target: string;
  status: BridgingGameStatus;
}

export interface BridgingGameResponse {
  game_id: string;
  sender_id: string;
  recipient_id?: string;
  recipient_type: BridgingRecipientType;
  anchor_word: string;
  target_word: string;
  clues?: string[];

  // V4 fidelity scoring (primary metric)
  fidelity?: number;               // 0-1: joint constraint score (coverage × efficiency)
  fidelity_percentile?: number;    // 0-100: percentile vs random baseline
  divergence?: number;             // 0-100: DAT-style spread score

  // Legacy scoring fields - kept for backwards compatibility
  relevance?: number;              // 0-1: mean similarity to anchor+target
  relevance_percentile?: number;   // 0-100: percentile vs random baseline
  divergence_score?: number;       // Old divergence (angular, 0-100)
  binding_score?: number;          // Old binding (min-based, 0-100)

  // Lexical union (statistical baseline)
  lexical_bridge?: string[];
  lexical_fidelity?: number;       // V4: fidelity of lexical union
  lexical_relevance?: number;      // Legacy: relevance of lexical union
  lexical_divergence?: number;     // Spread of lexical union
  lexical_similarity?: number;     // Legacy: similarity to user's union

  // Human recipient guesses (legacy V1)
  guessed_anchor?: string;
  guessed_target?: string;
  reconstruction_score?: number;
  anchor_similarity?: number;
  target_similarity?: number;
  order_swapped?: boolean;
  exact_anchor_match?: boolean;
  exact_target_match?: boolean;

  // Recipient union (V2/V4)
  recipient_clues?: string[];
  recipient_fidelity?: number;     // V4: fidelity of recipient's union
  recipient_relevance?: number;    // Legacy: relevance of recipient's union
  recipient_divergence?: number;   // Spread of recipient's union
  recipient_binding?: number;      // Legacy: old binding score
  bridge_similarity?: number;      // Legacy: similarity between unions

  // Haiku guesses (legacy V1)
  haiku_guessed_anchor?: string;
  haiku_guessed_target?: string;
  haiku_reconstruction_score?: number;

  // Haiku union (V2/V4)
  haiku_clues?: string[];
  haiku_fidelity?: number;         // V4: fidelity of Haiku's union
  haiku_relevance?: number;        // Legacy: relevance of Haiku's union
  haiku_divergence?: number;       // Spread of Haiku's union
  haiku_binding?: number;          // Legacy: old binding score
  haiku_bridge_similarity?: number; // Legacy: similarity to user's union

  // Statistical baseline (legacy)
  statistical_guessed_anchor?: string;
  statistical_guessed_target?: string;
  statistical_baseline_score?: number;

  status: BridgingGameStatus;
  share_code?: string;
  created_at: string;
  completed_at?: string;
}

export interface TriggerHaikuGuessResponse {
  game_id: string;
  haiku_guessed_anchor: string;
  haiku_guessed_target: string;
  haiku_reconstruction_score: number;
}

export interface TriggerHaikuBridgeResponse {
  game_id: string;
  haiku_clues: string[];
  haiku_divergence: number;
  haiku_bridge_similarity: number;
}

// ============================================
// INS-001.2 V2: Bridge-vs-Bridge Types
// ============================================

export interface SemanticDistanceResponse {
  anchor: string;
  target: string;
  distance: number;
  // DAT-style interpretation (v3): aligned with DAT norms (Olson et al., 2021)
  interpretation: 'identical' | 'close' | 'below average' | 'average' | 'above average' | 'distant';
}

export interface JoinBridgingGameResponseV2 {
  game_id: string;
  anchor_word: string;
  target_word: string;
  sender_clue_count: number;
}

export interface SubmitBridgingBridgeRequest {
  clues: string[];
  clue_timings?: ClueTiming[];
}

export interface SubmitBridgingBridgeResponse {
  game_id: string;
  // Recipient's bridge
  recipient_clues: string[];
  recipient_fidelity: number;
  recipient_divergence: number;
  recipient_relevance?: number;  // Legacy
  // Sender's bridge
  sender_clues: string[];
  sender_fidelity: number;
  sender_divergence: number;
  sender_relevance?: number;  // Legacy
  // Bridge comparison
  bridge_similarity: number;
  centroid_similarity?: number;
  path_alignment?: number;
  // Haiku baseline (from sender's original game)
  haiku_clues?: string[];
  haiku_fidelity?: number;
  haiku_relevance?: number;  // Legacy
  haiku_divergence?: number;
  // Statistical baseline (from sender's original game)
  lexical_bridge?: string[];
  lexical_fidelity?: number;
  lexical_relevance?: number;  // Legacy
  lexical_divergence?: number;
  // Meta
  anchor_word: string;
  target_word: string;
  status: BridgingGameStatus;
}

export interface BridgingGameResponseV2 {
  game_id: string;
  sender_id: string;
  recipient_id?: string;
  recipient_type: BridgingRecipientType;
  anchor_word: string;
  target_word: string;
  // Sender's bridge
  clues?: string[];
  divergence_score?: number;
  binding_score?: number;
  // Recipient's bridge (V2)
  recipient_clues?: string[];
  recipient_divergence?: number;
  recipient_binding?: number;
  bridge_similarity?: number;
  path_alignment?: number;
  // Haiku's bridge (V2)
  haiku_clues?: string[];
  haiku_divergence?: number;
  haiku_binding?: number;
  haiku_bridge_similarity?: number;
  // Legacy fields
  guessed_anchor?: string;
  guessed_target?: string;
  reconstruction_score?: number;
  haiku_guessed_anchor?: string;
  haiku_guessed_target?: string;
  haiku_reconstruction_score?: number;
  // State
  status: BridgingGameStatus;
  share_code?: string;
  created_at: string;
  completed_at?: string;
}

// ============================================
// User & Profile Types
// ============================================

export interface UserResponse {
  user_id: string;
  display_name?: string;
  is_anonymous: boolean;
  email?: string;
  games_played: number;
  profile_ready: boolean;
  terms_accepted_at?: string;
  created_at: string;
}

export interface ProfileResponse {
  user_id: string;
  games_played: number;
  divergence_mean?: number;
  divergence_std?: number;
  divergence_n: number;
  network_convergence_mean?: number;
  network_games: number;
  stranger_convergence_mean?: number;
  stranger_games: number;
  llm_convergence_mean?: number;
  llm_games: number;
  radiation_games: number;
  bridging_games: number;
  semantic_portability?: number;
  consistency_score?: number;
  archetype?: string;
  profile_ready: boolean;
  games_until_ready: number;
}

export interface GameHistoryItem {
  game_id: string;
  game_type: 'radiation' | 'bridging';
  seed_word?: string;
  anchor_word?: string;
  target_word?: string;
  divergence?: number;
  fidelity?: number;  // V4: primary metric for bridging
  relevance?: number;  // Legacy
  convergence?: number;
  status: string;
  created_at: string;
  completed_at?: string;
}

export interface GameHistoryResponse {
  games: GameHistoryItem[];
  total: number;
  limit: number;
  offset: number;
}

// Helper to get auth headers
async function getAuthHeaders(): Promise<HeadersInit> {
  // Check for existing session
  let { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError) {
    console.error('Session error in getAuthHeaders:', sessionError);
    // Try to sign in anonymously as fallback
    const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
    if (authError) {
      throw new Error(`Authentication failed: ${authError.message}`);
    }
    session = authData.session;
  }
  
  if (!session) {
    // Try to sign in anonymously
    const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
    if (authError) {
      console.error('Failed to sign in anonymously:', authError);
      throw new Error(`Authentication failed: ${authError.message}`);
    }
    session = authData.session;
  }
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  } else {
    console.error('No access token in session:', session);
    throw new Error('No access token available. Please refresh the page.');
  }
  
  return headers;
}

// Generic API call helper
async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeaders();
  
  // Ensure API_URL doesn't have trailing slash and endpoint starts with /
  let baseUrl = API_URL.replace(/\/$/, '');
  
  // Defensive check: ensure baseUrl has a protocol (runtime safety net)
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = `https://${baseUrl}`;
  }
  
  const endpointPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const fullUrl = `${baseUrl}${endpointPath}`;

  try {
    const response = await fetch(fullUrl, {
      ...options,
      credentials: 'include', // Include credentials for cross-origin requests
      headers: {
        ...headers,
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status} ${response.statusText}`;

      try {
        const errorData = await response.json();
        const detail = errorData.detail || errorData.message || errorData.error || errorMessage;
        if (typeof detail === 'object' && detail !== null) {
          errorMessage = detail.message || JSON.stringify(detail);
        } else {
          errorMessage = String(detail);
        }
      } catch {
        try {
          const errorText = await response.text();
          errorMessage = errorText || errorMessage;
        } catch {
          // Keep default error message
        }
      }

      if (response.status === 403) {
        errorMessage = `403 Forbidden: ${errorMessage}`;
      }

      throw new Error(errorMessage);
    }
    
    return response.json();
  } catch (error) {
    // Network errors (CORS, connection refused, etc.)
    if (error instanceof TypeError && (error.message.includes('fetch') || error.message.includes('Failed to fetch'))) {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'unknown';
      const isCorsError = error.message.includes('CORS') || error.message.includes('Access-Control');

      if (isCorsError) {
        throw new Error(`CORS error: API at ${API_URL} is blocking requests from ${origin}`);
      } else {
        throw new Error(`Network error: Cannot connect to API at ${API_URL}`);
      }
    }
    throw error;
  }
}

// API client
export const api = {
  games: {
    create: (data: CreateGameRequest): Promise<CreateGameResponse> =>
      apiCall('/api/v1/games/', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    get: (id: string): Promise<GameResponse> =>
      apiCall(`/api/v1/games/${id}`),

    submitClues: (id: string, data: SubmitCluesRequest): Promise<SubmitCluesResponse> =>
      apiCall(`/api/v1/games/${id}/clues`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    submitGuesses: (id: string, data: SubmitGuessesRequest): Promise<SubmitGuessesResponse> =>
      apiCall(`/api/v1/games/${id}/guesses`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    suggest: (attempt?: number): Promise<SuggestWordResponse> => {
      const params = new URLSearchParams();
      if (attempt) params.set('attempt', attempt.toString());
      const query = params.toString();
      return apiCall(`/api/v1/bridging/suggest${query ? `?${query}` : ''}`);
    },
  },
  
  share: {
    createToken: (gameId: string): Promise<CreateShareTokenResponse> =>
      apiCall(`/api/v1/games/${gameId}/share`, {
        method: 'POST',
      }),
    
    join: (token: string): Promise<JoinGameResponse> =>
      apiCall(`/api/v1/join/${token}`, {
        method: 'POST',
      }),
  },
  
  embeddings: {
    validate: (word: string): Promise<{ word: string; valid: boolean }> =>
      apiCall('/api/v1/embeddings/validate', {
        method: 'POST',
        body: JSON.stringify({ word }),
      }),
  },

  // INS-001.2: Bridging API
  bridging: {
    create: (data: CreateBridgingGameRequest): Promise<CreateBridgingGameResponse> =>
      apiCall('/api/v1/bridging/', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    get: (id: string): Promise<BridgingGameResponse> =>
      apiCall(`/api/v1/bridging/${id}`),

    submitClues: (id: string, data: SubmitBridgingCluesRequest): Promise<SubmitBridgingCluesResponse> =>
      apiCall(`/api/v1/bridging/${id}/clues`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    submitGuess: (id: string, data: SubmitBridgingGuessRequest): Promise<SubmitBridgingGuessResponse> =>
      apiCall(`/api/v1/bridging/${id}/guess`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    suggest: (fromWord?: string, attempt?: number): Promise<SuggestWordResponse> => {
      const params = new URLSearchParams();
      if (fromWord) params.set('from_word', fromWord);
      if (attempt) params.set('attempt', attempt.toString());
      const query = params.toString();
      return apiCall(`/api/v1/bridging/suggest${query ? `?${query}` : ''}`);
    },

    createShare: (gameId: string): Promise<CreateBridgingShareResponse> =>
      apiCall(`/api/v1/bridging/${gameId}/share`, {
        method: 'POST',
      }),

    join: (shareCode: string): Promise<JoinBridgingGameResponse> =>
      apiCall(`/api/v1/bridging/join/${shareCode}`, {
        method: 'POST',
      }),

    triggerHaikuGuess: (gameId: string): Promise<TriggerHaikuGuessResponse> =>
      apiCall(`/api/v1/bridging/${gameId}/haiku-guess`, {
        method: 'POST',
      }),

    triggerHaikuBridge: (gameId: string): Promise<TriggerHaikuBridgeResponse> =>
      apiCall(`/api/v1/bridging/${gameId}/haiku-bridge`, {
        method: 'POST',
      }),

    // V2: Bridge-vs-Bridge methods
    getDistance: (anchor: string, target: string): Promise<SemanticDistanceResponse> =>
      apiCall(`/api/v1/bridging/distance?anchor=${encodeURIComponent(anchor)}&target=${encodeURIComponent(target)}`),

    joinV2: (shareCode: string): Promise<JoinBridgingGameResponseV2> =>
      apiCall(`/api/v1/bridging/join-v2/${shareCode}`, {
        method: 'POST',
      }),

    submitBridge: (id: string, data: SubmitBridgingBridgeRequest): Promise<SubmitBridgingBridgeResponse> =>
      apiCall(`/api/v1/bridging/${id}/bridge`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // User & Profile API
  users: {
    getMe: (): Promise<UserResponse> =>
      apiCall('/api/v1/users/me'),

    getProfile: (): Promise<ProfileResponse> =>
      apiCall('/api/v1/users/me/profile'),

    getGameHistory: (limit = 20, offset = 0): Promise<GameHistoryResponse> =>
      apiCall(`/api/v1/users/me/games?limit=${limit}&offset=${offset}`),

    acceptTerms: (): Promise<{ accepted: boolean }> =>
      apiCall('/api/v1/users/me/accept-terms', {
        method: 'POST',
        body: JSON.stringify({ accepted: true }),
      }),

    transferGames: (anonymousUserId: string): Promise<{ transferred_count: number; message: string }> =>
      apiCall('/api/v1/users/me/transfer-games', {
        method: 'POST',
        body: JSON.stringify({ anonymous_user_id: anonymousUserId }),
      }),
  },

  // ============================================
  // STUDIES API
  // ============================================

  studies: {
    get: (slug: string): Promise<StudyResponse> =>
      apiCall(`/api/v1/studies/${slug}`),

    enroll: (slug: string): Promise<EnrollResponse> =>
      apiCall(`/api/v1/studies/${slug}/enroll`, { method: 'POST' }),

    consent: (slug: string): Promise<{ consented_at: string }> =>
      apiCall(`/api/v1/studies/${slug}/consent`, { method: 'POST' }),

    getSurveyItems: (slug: string, timing: 'pre' | 'post'): Promise<{ timing: string; items: SurveyItem[] }> =>
      apiCall(`/api/v1/studies/${slug}/survey/${timing}`),

    submitSurvey: (slug: string, timing: 'pre' | 'post', responses: SurveyResponse[]): Promise<{ timing: string; submitted_at: string }> =>
      apiCall(`/api/v1/studies/${slug}/survey`, {
        method: 'POST',
        body: JSON.stringify({ timing, responses }),
      }),

    getProgress: (slug: string): Promise<StudyProgressResponse> =>
      apiCall(`/api/v1/studies/${slug}/progress`),

    // v3: next-item (handles both generative and evaluative)
    nextItem: (slug: string): Promise<StudyNextItemResponse> =>
      apiCall(`/api/v1/studies/${slug}/next-item`, { method: 'POST' }),

    // Backwards compat alias
    nextGame: (slug: string): Promise<StudyNextItemResponse> =>
      apiCall(`/api/v1/studies/${slug}/next-item`, { method: 'POST' }),

    submitGame: (slug: string, gameId: string, words: string[], autoSubmitted: boolean = false, timeMs?: number): Promise<StudyGameScoreResponse> =>
      apiCall(`/api/v1/studies/${slug}/games/${gameId}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          words,
          auto_submitted: autoSubmitted,
          time_to_complete_ms: timeMs,
        }),
      }),

    // v3: submit evaluative item
    submitEvaluation: (slug: string, itemNumber: number, response: Record<string, any>, timeMs?: number): Promise<StudyEvaluationScoreResponse> =>
      apiCall(`/api/v1/studies/${slug}/evaluations/${itemNumber}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          response,
          time_to_complete_ms: timeMs,
        }),
      }),

    // v3: opt for partial completion at break
    optPartial: (slug: string, partial: boolean): Promise<{ opted_partial: boolean }> =>
      apiCall(`/api/v1/studies/${slug}/opt-partial`, {
        method: 'POST',
        body: JSON.stringify({ opted_partial: partial }),
      }),

    getDashboard: (slug: string): Promise<StudyDashboardResponse> =>
      apiCall(`/api/v1/studies/${slug}/dashboard`),
  },
};

// ============================================
// STUDIES TYPES (v3)
// ============================================

export interface StudyResponse {
  slug: string;
  title: string;
  description: string | null;
  game_count: number;      // total items in battery
  is_active: boolean;
  participant_count: number;
  require_auth: boolean;
}

export interface EnrollResponse {
  enrollment_id: number;
  study_slug: string;
  games_completed: number;
  items_completed: number;
  already_enrolled: boolean;
}

export interface SurveyItem {
  id: string;
  type: 'likert' | 'categorical' | 'text';
  text: string;
  labels?: string[];
  options?: string[];
}

export interface SurveyResponse {
  item_id: string;
  value: string | number;
}

// v3 item config (generative items)
export interface StudyItemConfig {
  item_number: number;
  type: 'generative' | 'evaluative';
  task: 'dat' | 'rat' | 'bridge' | 'alignment_ranking' | 'parsimony_loo' | 'peer_rating';
  m: number;
  n: number;
  targets: string[];
  solution: string | null;
  min_words: number;
  show_timer: boolean;
  show_worked_example: boolean;
  instructions: string;
  scoring: Record<string, boolean>;
  optional?: boolean;
  // Evaluative-specific fields
  stimulus_sets?: Record<string, { label: string; words: string[]; precomputed_alignment: number | null }>;
  stimulus_set?: { words: string[]; expected_redundant: string; precomputed_deltas: Record<string, number> | null };
  dimensions?: Array<{ key: string; prompt: string; low: string; high: string }>;
  source_item?: number;
  n_responses_to_rate?: number;
  cold_start_threshold?: number;
  cold_start_sets?: Record<string, { words: string[]; precomputed_divergence: number | null; precomputed_alignment: number | null; precomputed_parsimony: number | null }>;
}

// Backwards compat alias
export type StudyGameConfig = StudyItemConfig;

export interface WorkedExample {
  show_before_item: number;
  targets: string[];
  associations: string[];
  explanations: Array<{ word: string; connections: string }>;
}

// v3 next-item response (covers both generative and evaluative)
export interface StudyNextItemResponse {
  // Generative items
  game_id?: string;
  // Common fields
  item_number: number;
  config: StudyItemConfig;
  worked_example: WorkedExample | null;
  resumed: boolean;
  show_break: boolean;
  // Evaluative items
  stimulus?: Record<string, any>;
}

// Backwards compat alias
export type StudyNextGameResponse = StudyNextItemResponse;

export interface StudyGameScoreResponse {
  game_id: string;
  game_number: number;
  item_number: number;
  game_type: string;
  scores: Record<string, number | boolean>;
  percentiles: Record<string, number> | null;
  exact_match: boolean | null;
  insufficient_data: boolean;
  comparison?: {
    paired_item: number;
    paired_scores: Record<string, number | boolean>;
    deltas: Record<string, number>;
  } | null;
}

export interface StudyEvaluationScoreResponse {
  item_number: number;
  task: string;
  feedback: Record<string, any>;
  correct?: boolean;
}

export interface StudyProgressResponse {
  study_slug: string;
  enrollment_id: number;
  games_completed: number;
  items_completed: number;
  total_games: number;
  total_items: number;
  completed_at: string | null;
  consented_at: string | null;
  pre_survey_done: boolean;
  post_survey_done: boolean;
  opted_partial: boolean | null;
  game_scores: Array<{
    game_id: string;
    game_number: number;
    item_number: number;
    game_type: string;
    status: string;
    scores: Record<string, number | boolean>;
  }>;
  evaluation_scores: Array<{
    item_number: number;
    task: string;
    feedback: Record<string, any>;
  }>;
}

export interface StudyDashboardResponse {
  study_slug: string;
  study_title: string;
  participant_count: number;
  insufficient_data: boolean;
  aggregate_percentiles: Record<string, number> | null;
  per_game_scores: Array<{
    game_number: number;
    item_number: number;
    game_type: string;
    m: number;
    n: number;
    scores: Record<string, number | boolean>;
    percentiles?: Record<string, number>;
  }>;
  scatterplot_data: Array<{
    sender_id: string;
    game_number: number;
    divergence: number;
    alignment: number;
    parsimony: number | null;
    is_current_user: boolean;
  }> | null;
  learning_curve: Array<{
    game_number: number;
    game_type: string;
    divergence_percentile: number | null;
    alignment_percentile: number | null;
    parsimony_percentile: number | null;
  }> | null;
  comparison_charts: Array<{
    label: string;
    item_a: number;
    item_b: number;
    scores_a: Record<string, number>;
    scores_b: Record<string, number>;
  }> | null;
  peer_feedback: {
    item_number: number;
    n_raters: number;
    mean_difference: number;
    mean_connection: number;
    mean_uniqueness: number;
  } | null;
}
