/**
 * Main Game Component - Sender Flow
 * 
 * State machine router for all game screens
 */

import React from 'react';
import { GameProvider, useGameState } from '../lib/state';
import { Navigation } from './ui/Navigation';
import { IntroScreen } from './screens/IntroScreen';
import { SeedScreen } from './screens/SeedScreen';
import { SenseDisambiguationScreen } from './screens/SenseDisambiguationScreen';
import { CluesScreen } from './screens/CluesScreen';
import { ShareScreen } from './screens/ShareScreen';
import { ResultsScreen } from './screens/ResultsScreen';

function GameRouter() {
  const { state } = useGameState();
  
  switch (state.screen) {
    case 'intro':
      return <IntroScreen />;
    case 'seed':
      return <SeedScreen />;
    case 'sense':
      return <SenseDisambiguationScreen seedWord={state.seedWord} senseOptions={state.senseOptions} />;
    case 'clues':
      return <CluesScreen gameId={state.gameId} noiseFloor={state.noiseFloor} seedWord={state.seedWord} />;
    case 'share':
      return <ShareScreen gameId={state.gameId} divergence={state.divergence} />;
    case 'results':
      return <ResultsScreen game={state.game} />;
    default:
      return <IntroScreen />;
  }
}

export default function Game() {
  return (
    <GameProvider>
      <Navigation instrumentId="INS-001.1" instrumentTitle="SIGNAL" />
      <GameRouter />
    </GameProvider>
  );
}
