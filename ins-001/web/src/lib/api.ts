/**
 * API Client - INS-001
 * 
 * Typed API client for backend communication
 */

import { supabase } from './supabase';

const API_URL = import.meta.env.PUBLIC_API_URL || 'http://localhost:8000';

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
  const { data: { session } } = await supabase.auth.getSession();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  
  return headers;
}

// Generic API call helper
async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeaders();
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.detail?.error || error.error || `HTTP ${response.status}`);
  }
  
  return response.json();
}

// API client
export const api = {
  games: {
    create: (data: CreateGameRequest): Promise<CreateGameResponse> =>
      apiCall('/api/v1/games', {
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
