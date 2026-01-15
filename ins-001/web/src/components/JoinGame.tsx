/**
 * Join Game Component - Recipient Flow
 * 
 * State machine for recipient screens
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { api } from '../lib/api';
import type { JoinGameResponse, SubmitGuessesResponse } from '../lib/api';
import { JoinScreen } from './screens/JoinScreen';
import { GuessResultsScreen } from './screens/GuessResultsScreen';
import { ErrorScreen } from './screens/ErrorScreen';

interface JoinGameProps {
  token: string;
}

type RecipientGameState =
  | { screen: 'loading'; token: string }
  | { screen: 'error'; error: 'expired' | 'already_joined' | 'not_found' | 'network' }
  | { screen: 'join'; game: JoinGameResponse }
  | { screen: 'results'; game: SubmitGuessesResponse; guesses: string[] };

export default function JoinGame({ token }: JoinGameProps) {
  const [state, setState] = useState<RecipientGameState>({ screen: 'loading', token });
  
  useEffect(() => {
    // Auto-sign in anonymously if no session
    const initializeAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        await supabase.auth.signInAnonymously();
      }
      
      // Try to join game
      try {
        const game = await api.share.join(token);
        setState({ screen: 'join', game });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        
        if (errorMessage.includes('expired')) {
          setState({ screen: 'error', error: 'expired' });
        } else if (errorMessage.includes('already has a recipient')) {
          setState({ screen: 'error', error: 'already_joined' });
        } else if (errorMessage.includes('not found')) {
          setState({ screen: 'error', error: 'not_found' });
        } else {
          setState({ screen: 'error', error: 'network' });
        }
      }
    };
    
    initializeAuth();
  }, [token]);
  
  const handleGuessesSubmitted = (response: SubmitGuessesResponse, guesses: string[]) => {
    setState({ screen: 'results', game: response, guesses });
  };
  
  switch (state.screen) {
    case 'loading':
      return <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--faded)' }}>Loading...</div>;
    case 'error':
      return <ErrorScreen error={state.error} />;
    case 'join':
      return <JoinScreen game={state.game} onGuessesSubmitted={handleGuessesSubmitted} />;
    case 'results':
      return <GuessResultsScreen game={state.game} guesses={state.guesses} />;
    default:
      return null;
  }
}
