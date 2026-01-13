/**
 * Game State Management - Sender Flow
 * 
 * React Context + useReducer for game state machine
 */

import { createContext, useContext, useReducer } from 'react';
import type { ReactNode } from 'react';
import type { NoiseFloorWord, GameResponse } from './api';

// State types
export type SenderGameState =
  | { screen: 'intro' }
  | { screen: 'seed' }
  | { screen: 'sense'; seedWord: string; senseOptions: string[] }
  | { screen: 'clues'; gameId: string; noiseFloor: NoiseFloorWord[]; seedWord: string }
  | { screen: 'share'; gameId: string; divergence: number; noiseFloor?: NoiseFloorWord[]; seedWord?: string }
  | { screen: 'results'; game: GameResponse };

// Action types
type GameAction =
  | { type: 'BEGIN' }
  | { type: 'BACK' }
  | { type: 'SEED_SUBMITTED'; seedWord: string; isPolysemous: boolean; senseOptions?: string[]; gameId?: string; noiseFloor?: NoiseFloorWord[] }
  | { type: 'SENSE_SELECTED'; gameId: string; noiseFloor: NoiseFloorWord[]; seedWord: string }
  | { type: 'CLUES_SUBMITTED'; gameId: string; divergence: number; noiseFloor?: NoiseFloorWord[]; seedWord?: string }
  | { type: 'GAME_COMPLETED'; game: GameResponse }
  | { type: 'RESET' };

// Reducer
function gameReducer(state: SenderGameState, action: GameAction): SenderGameState {
  switch (action.type) {
    case 'BEGIN':
      return { screen: 'seed' };
    
    case 'BACK':
      // Navigate back through the flow
      if (state.screen === 'clues') return { screen: 'seed' };
      if (state.screen === 'share' && state.noiseFloor && state.seedWord) {
        return { screen: 'clues', gameId: state.gameId, noiseFloor: state.noiseFloor, seedWord: state.seedWord };
      }
      if (state.screen === 'share') return { screen: 'seed' }; // Fallback if data not available
      if (state.screen === 'seed') return { screen: 'intro' };
      return state;
    
    case 'SEED_SUBMITTED':
      if (action.isPolysemous && action.senseOptions) {
        return {
          screen: 'sense',
          seedWord: action.seedWord,
          senseOptions: action.senseOptions
        };
      }
      if (action.gameId && action.noiseFloor) {
        return {
          screen: 'clues',
          gameId: action.gameId,
          noiseFloor: action.noiseFloor,
          seedWord: action.seedWord
        };
      }
      return state;
    
    case 'SENSE_SELECTED':
      return {
        screen: 'clues',
        gameId: action.gameId,
        noiseFloor: action.noiseFloor,
        seedWord: action.seedWord
      };
    
    case 'CLUES_SUBMITTED':
      return {
        screen: 'share',
        gameId: action.gameId,
        divergence: action.divergence,
        noiseFloor: action.noiseFloor,
        seedWord: action.seedWord
      };
    
    case 'GAME_COMPLETED':
      return {
        screen: 'results',
        game: action.game
      };
    
    case 'RESET':
      return { screen: 'intro' };
    
    default:
      return state;
  }
}

// Context
interface GameContextType {
  state: SenderGameState;
  dispatch: React.Dispatch<GameAction>;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

// Provider
export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, { screen: 'intro' });
  
  return (
    <GameContext.Provider value={{ state, dispatch }}>
      {children}
    </GameContext.Provider>
  );
}

// Hook
export function useGameState() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGameState must be used within GameProvider');
  }
  return context;
}
