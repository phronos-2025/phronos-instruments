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

// Debug: Log API URL (remove in production)
if (typeof window !== 'undefined') {
  console.log('API_URL configured as:', API_URL);
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
  status: GameStatus;
  created_at: string;
  expires_at: string;
}

// Helper to get auth headers
async function getAuthHeaders(): Promise<HeadersInit> {
  // #region agent log
  console.log('[DEBUG] getAuthHeaders entry', {timestamp:Date.now(),hypothesisId:'A'});
  // #endregion
  // Check for existing session
  let { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  // #region agent log
  console.log('[DEBUG] Session check result', {hasSession:!!session,hasError:!!sessionError,errorMsg:sessionError?.message,hasAccessToken:!!session?.access_token,tokenLength:session?.access_token?.length,hypothesisId:'B'});
  // #endregion
  
  if (sessionError) {
    console.error('Session error in getAuthHeaders:', sessionError);
    // #region agent log
    console.log('[DEBUG] Session error, attempting anonymous sign-in', {error:sessionError.message,hypothesisId:'C'});
    // #endregion
    // Try to sign in anonymously as fallback
    const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
    if (authError) {
      throw new Error(`Authentication failed: ${authError.message}`);
    }
    session = authData.session;
    // #region agent log
    console.log('[DEBUG] Anonymous sign-in result', {hasSession:!!session,hasAccessToken:!!session?.access_token,tokenLength:session?.access_token?.length,hypothesisId:'C'});
    // #endregion
  }
  
  if (!session) {
    // Try to sign in anonymously
    console.log('No session, attempting anonymous sign-in...');
    // #region agent log
    console.log('[DEBUG] No session, attempting anonymous sign-in', {hypothesisId:'D'});
    // #endregion
    const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
    if (authError) {
      console.error('Failed to sign in anonymously:', authError);
      throw new Error(`Authentication failed: ${authError.message}`);
    }
    session = authData.session;
    // #region agent log
    console.log('[DEBUG] Anonymous sign-in completed', {hasSession:!!session,hasAccessToken:!!session?.access_token,tokenLength:session?.access_token?.length,hypothesisId:'D'});
    // #endregion
  }
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
    // #region agent log
    console.log('[DEBUG] Authorization header set', {hasAuthHeader:!!headers['Authorization'],headerPrefix:headers['Authorization']?.substring(0,20),tokenLength:session.access_token.length,hypothesisId:'A'});
    // #endregion
  } else {
    console.error('No access token in session:', session);
    // #region agent log
    console.log('[DEBUG] No access token in session', {hasSession:!!session,sessionKeys:session?Object.keys(session):[],hypothesisId:'B'});
    // #endregion
    throw new Error('No access token available. Please refresh the page.');
  }
  
  // #region agent log
  console.log('[DEBUG] getAuthHeaders exit', {headerKeys:Object.keys(headers),hasAuth:!!headers['Authorization'],hypothesisId:'A'});
  // #endregion
  return headers;
}

// Generic API call helper
async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeaders();
  
  // #region agent log
  console.log('[DEBUG] apiCall before fetch', {endpoint,hasAuthHeader:!!headers['Authorization'],allHeaderKeys:Object.keys(headers),hypothesisId:'E'});
  // #endregion
  
  // Ensure API_URL doesn't have trailing slash and endpoint starts with /
  let baseUrl = API_URL.replace(/\/$/, '');
  
  // Defensive check: ensure baseUrl has a protocol (runtime safety net)
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = `https://${baseUrl}`;
  }
  
  const endpointPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const fullUrl = `${baseUrl}${endpointPath}`;
  
  console.log('API Call:', fullUrl); // Debug log
  
  // #region agent log
  const mergedHeaders = {...headers,...options.headers};
  console.log('[DEBUG] About to fetch', {url:fullUrl,hasAuthInMerged:!!mergedHeaders['Authorization'],mergedHeaderKeys:Object.keys(mergedHeaders),hypothesisId:'E'});
  // #endregion
  
  try {
    const response = await fetch(fullUrl, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });
    
    // #region agent log
    console.log('[DEBUG] Fetch response received', {status:response.status,statusText:response.statusText,ok:response.ok,hypothesisId:'F'});
    // #endregion
    
    if (!response.ok) {
      // Try to get error details
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.detail || errorData.message || errorData.error || errorMessage;
        // If detail is an object, try to extract message
        if (typeof errorMessage === 'object') {
          errorMessage = errorMessage.message || JSON.stringify(errorMessage);
        }
      } catch {
        // If JSON parsing fails, try text
        try {
          const errorText = await response.text();
          errorMessage = errorText || errorMessage;
        } catch {
          // Keep default error message
        }
      }
      throw new Error(errorMessage);
    }
    
    return response.json();
  } catch (error) {
    // Network errors (CORS, connection refused, etc.)
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(`Network error: Cannot connect to API at ${API_URL}. Check CORS and API URL.`);
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
};
