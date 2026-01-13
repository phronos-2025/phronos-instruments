/**
 * Game State Management - INS-001.2 Bridging Flow
 *
 * React Context + useReducer for bridging game state machine.
 * Handles both sender (create bridge) and recipient (reconstruct bridge) flows.
 */

import { createContext, useContext, useReducer } from 'react';
import type { ReactNode } from 'react';
import type { BridgingGameResponse } from './api';

// ============================================
// SENDER STATE
// ============================================

export type BridgingSenderState =
  | { screen: 'intro' }
  | { screen: 'anchor-target'; anchor?: string; target?: string }
  | { screen: 'clues'; gameId: string; anchor: string; target: string }
  | {
      screen: 'share';
      gameId: string;
      anchor: string;
      target: string;
      clues: string[];
      divergence: number;
      shareCode?: string;
    }
  | { screen: 'results'; game: BridgingGameResponse };

type BridgingSenderAction =
  | { type: 'BEGIN' }
  | { type: 'BACK' }
  | { type: 'ANCHOR_TARGET_SET'; anchor: string; target: string }
  | { type: 'GAME_CREATED'; gameId: string; anchor: string; target: string }
  | {
      type: 'CLUES_SUBMITTED';
      gameId: string;
      clues: string[];
      divergence: number;
      shareCode?: string;
    }
  | { type: 'GAME_COMPLETED'; game: BridgingGameResponse }
  | { type: 'RESET' };

function bridgingSenderReducer(
  state: BridgingSenderState,
  action: BridgingSenderAction
): BridgingSenderState {
  switch (action.type) {
    case 'BEGIN':
      return { screen: 'anchor-target' };

    case 'BACK':
      if (state.screen === 'clues') {
        return { screen: 'anchor-target' };
      }
      if (state.screen === 'share') {
        return {
          screen: 'clues',
          gameId: state.gameId,
          anchor: state.anchor,
          target: state.target,
        };
      }
      if (state.screen === 'anchor-target') {
        return { screen: 'intro' };
      }
      return state;

    case 'ANCHOR_TARGET_SET':
      return {
        screen: 'anchor-target',
        anchor: action.anchor,
        target: action.target,
      };

    case 'GAME_CREATED':
      return {
        screen: 'clues',
        gameId: action.gameId,
        anchor: action.anchor,
        target: action.target,
      };

    case 'CLUES_SUBMITTED':
      if (state.screen === 'clues') {
        return {
          screen: 'share',
          gameId: action.gameId,
          anchor: state.anchor,
          target: state.target,
          clues: action.clues,
          divergence: action.divergence,
          shareCode: action.shareCode,
        };
      }
      return state;

    case 'GAME_COMPLETED':
      return {
        screen: 'results',
        game: action.game,
      };

    case 'RESET':
      return { screen: 'intro' };

    default:
      return state;
  }
}

// ============================================
// RECIPIENT STATE
// ============================================

export type BridgingRecipientState =
  | { screen: 'loading' }
  | { screen: 'error'; message: string }
  | { screen: 'join'; gameId: string; clues: string[] }
  | {
      screen: 'results';
      gameId: string;
      clues: string[];
      guessedAnchor: string;
      guessedTarget: string;
      trueAnchor: string;
      trueTarget: string;
      reconstructionScore: number;
      anchorSimilarity: number;
      targetSimilarity: number;
      orderSwapped: boolean;
      exactAnchorMatch: boolean;
      exactTargetMatch: boolean;
    };

type BridgingRecipientAction =
  | { type: 'GAME_LOADED'; gameId: string; clues: string[] }
  | { type: 'ERROR'; message: string }
  | {
      type: 'GUESS_SUBMITTED';
      guessedAnchor: string;
      guessedTarget: string;
      trueAnchor: string;
      trueTarget: string;
      reconstructionScore: number;
      anchorSimilarity: number;
      targetSimilarity: number;
      orderSwapped: boolean;
      exactAnchorMatch: boolean;
      exactTargetMatch: boolean;
    }
  | { type: 'RESET' };

function bridgingRecipientReducer(
  state: BridgingRecipientState,
  action: BridgingRecipientAction
): BridgingRecipientState {
  switch (action.type) {
    case 'GAME_LOADED':
      return {
        screen: 'join',
        gameId: action.gameId,
        clues: action.clues,
      };

    case 'ERROR':
      return {
        screen: 'error',
        message: action.message,
      };

    case 'GUESS_SUBMITTED':
      if (state.screen === 'join') {
        return {
          screen: 'results',
          gameId: state.gameId,
          clues: state.clues,
          guessedAnchor: action.guessedAnchor,
          guessedTarget: action.guessedTarget,
          trueAnchor: action.trueAnchor,
          trueTarget: action.trueTarget,
          reconstructionScore: action.reconstructionScore,
          anchorSimilarity: action.anchorSimilarity,
          targetSimilarity: action.targetSimilarity,
          orderSwapped: action.orderSwapped,
          exactAnchorMatch: action.exactAnchorMatch,
          exactTargetMatch: action.exactTargetMatch,
        };
      }
      return state;

    case 'RESET':
      return { screen: 'loading' };

    default:
      return state;
  }
}

// ============================================
// CONTEXTS
// ============================================

interface BridgingSenderContextType {
  state: BridgingSenderState;
  dispatch: React.Dispatch<BridgingSenderAction>;
}

interface BridgingRecipientContextType {
  state: BridgingRecipientState;
  dispatch: React.Dispatch<BridgingRecipientAction>;
}

const BridgingSenderContext = createContext<BridgingSenderContextType | undefined>(undefined);
const BridgingRecipientContext = createContext<BridgingRecipientContextType | undefined>(undefined);

// ============================================
// PROVIDERS
// ============================================

export function BridgingSenderProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(bridgingSenderReducer, { screen: 'intro' });

  return (
    <BridgingSenderContext.Provider value={{ state, dispatch }}>
      {children}
    </BridgingSenderContext.Provider>
  );
}

export function BridgingRecipientProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(bridgingRecipientReducer, { screen: 'loading' });

  return (
    <BridgingRecipientContext.Provider value={{ state, dispatch }}>
      {children}
    </BridgingRecipientContext.Provider>
  );
}

// ============================================
// HOOKS
// ============================================

export function useBridgingSenderState() {
  const context = useContext(BridgingSenderContext);
  if (!context) {
    throw new Error('useBridgingSenderState must be used within BridgingSenderProvider');
  }
  return context;
}

export function useBridgingRecipientState() {
  const context = useContext(BridgingRecipientContext);
  if (!context) {
    throw new Error('useBridgingRecipientState must be used within BridgingRecipientProvider');
  }
  return context;
}
