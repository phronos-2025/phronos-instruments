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

// Debug: Log API URL and env var state (remove in production)
if (typeof window !== 'undefined') {
  console.log('=== API CONFIGURATION DEBUG ===');
  console.log('PUBLIC_API_URL from env:', import.meta.env.PUBLIC_API_URL);
  console.log('rawApiUrl:', rawApiUrl);
  console.log('API_URL (normalized):', API_URL);
  console.log('Is using default (localhost)?', !import.meta.env.PUBLIC_API_URL);
  console.log('================================');
}

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

export interface SubmitCluesRequest {
  clues: string[];
}

export interface SubmitCluesResponse {
  game_id: string;
  clues: string[];
  divergence_score: number;
  status: GameStatus;
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
}

export interface SubmitBridgingCluesResponse {
  game_id: string;
  clues: string[];
  divergence_score: number;
  binding_score: number;  // How well clues relate to both endpoints
  lexical_bridge?: string[];  // Optimal embedding-based path
  lexical_similarity?: number;  // Similarity between user clues and lexical union
  status: BridgingGameStatus;
  share_code?: string;
  // V2: Haiku builds its own bridge
  haiku_clues?: string[];
  haiku_divergence?: number;
  haiku_binding?: number;
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
  divergence_score?: number;
  binding_score?: number;  // How well clues relate to both endpoints
  lexical_bridge?: string[];  // Optimal embedding-based path
  lexical_similarity?: number;  // Similarity between user clues and lexical union
  // Human recipient guesses (legacy V1)
  guessed_anchor?: string;
  guessed_target?: string;
  reconstruction_score?: number;
  anchor_similarity?: number;
  target_similarity?: number;
  order_swapped?: boolean;
  exact_anchor_match?: boolean;
  exact_target_match?: boolean;
  // Recipient bridge (V2)
  recipient_clues?: string[];
  recipient_divergence?: number;
  recipient_binding?: number;
  bridge_similarity?: number;
  // Haiku guesses (legacy V1)
  haiku_guessed_anchor?: string;
  haiku_guessed_target?: string;
  haiku_reconstruction_score?: number;
  // Haiku bridge (V2)
  haiku_clues?: string[];
  haiku_divergence?: number;
  haiku_binding?: number;
  haiku_bridge_similarity?: number;
  // Statistical baseline
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
  interpretation: 'identical' | 'close' | 'moderate' | 'distant' | 'very distant';
}

export interface JoinBridgingGameResponseV2 {
  game_id: string;
  anchor_word: string;
  target_word: string;
  sender_clue_count: number;
}

export interface SubmitBridgingBridgeRequest {
  clues: string[];
}

export interface SubmitBridgingBridgeResponse {
  game_id: string;
  recipient_clues: string[];
  recipient_divergence: number;
  sender_clues: string[];
  sender_divergence: number;
  bridge_similarity: number;
  path_alignment?: number;
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
    console.log('No session, attempting anonymous sign-in...');
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
  
  console.log('API Call:', fullUrl); // Debug log
  console.log('API_URL from env:', API_URL);
  console.log('Current origin:', typeof window !== 'undefined' ? window.location.origin : 'N/A');
  
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
      // Log detailed error information for debugging
      console.error('=== API ERROR RESPONSE ===');
      console.error('Status:', response.status, response.statusText);
      console.error('URL:', fullUrl);
      console.error('Method:', options.method || 'GET');
      console.error('Headers sent:', headers);
      
      // Try to get error details from response body
      let errorMessage = `HTTP ${response.status} ${response.statusText}`;
      let errorDetails: any = null;
      
      try {
        const errorData = await response.json();
        errorDetails = errorData;
        errorMessage = errorData.detail || errorData.message || errorData.error || errorMessage;
        // If detail is an object, try to extract message
        if (typeof errorMessage === 'object') {
          errorMessage = errorMessage.message || JSON.stringify(errorMessage);
        }
        console.error('Error response body:', errorData);
      } catch {
        // If JSON parsing fails, try text
        try {
          const errorText = await response.text();
          errorMessage = errorText || errorMessage;
          console.error('Error response text:', errorText);
        } catch {
          // Keep default error message
          console.error('Could not read error response body');
        }
      }
      
      // For 403 errors, provide more specific guidance
      if (response.status === 403) {
        console.error('403 Forbidden - Possible causes:');
        console.error('1. Authentication token invalid or expired');
        console.error('2. User does not have permission for this resource');
        console.error('3. CORS preflight succeeded but actual request was rejected');
        console.error('4. Backend middleware rejecting the request');
        errorMessage = `403 Forbidden: ${errorMessage}. Check authentication token and user permissions.`;
      }
      
      console.error('================================');
      throw new Error(errorMessage);
    }
    
    return response.json();
  } catch (error) {
    // Network errors (CORS, connection refused, etc.)
    if (error instanceof TypeError) {
      if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
        // Log the actual error for debugging
        console.error('=== API REQUEST FAILED ===');
        console.error('Error type:', error.constructor.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        console.error('Request URL:', fullUrl);
        console.error('Request method:', options.method || 'GET');
        console.error('Request headers:', headers);
        console.error('Current origin:', typeof window !== 'undefined' ? window.location.origin : 'N/A');
        console.error('API URL:', API_URL);
        console.error('================================');
        
        // Check if it's a CORS error (browser blocks before response)
        const isCorsError = error.message.includes('CORS') || 
                           error.message.includes('Access-Control') ||
                           (typeof window !== 'undefined' && !error.message.includes('NetworkError'));
        
        let errorMsg;
        if (isCorsError) {
          errorMsg = `CORS error: API at ${API_URL} is blocking requests from ${window.location.origin}. ` +
            `Check Railway API CORS configuration and ensure it includes: ${window.location.origin}`;
        } else {
          errorMsg = `Network error: Cannot connect to API at ${API_URL}. ` +
            `Possible causes: ` +
            `1) API URL incorrect - check PUBLIC_API_URL env var, ` +
            `2) CORS not configured - add ${window.location.origin} to API CORS origins, ` +
            `3) API server not running or unreachable. ` +
            `Check browser Network tab for detailed error.`;
        }
        
        console.error('Final error message:', errorMsg);
        throw new Error(errorMsg);
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
};
