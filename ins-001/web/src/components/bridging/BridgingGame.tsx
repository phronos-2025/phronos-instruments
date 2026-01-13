/**
 * Main Bridging Game Component - INS-001.2 Sender Flow
 *
 * State machine router for all bridging game screens.
 */

import React from 'react';
import { BridgingSenderProvider, useBridgingSenderState } from '../../lib/bridging-state';
import { Navigation } from '../ui/Navigation';
import { BridgingIntroScreen } from './screens/BridgingIntroScreen';
import { AnchorTargetScreen } from './screens/AnchorTargetScreen';
import { BridgingCluesScreen } from './screens/BridgingCluesScreen';
import { BridgingShareScreen } from './screens/BridgingShareScreen';
import { BridgingResultsScreen } from './screens/BridgingResultsScreen';

function BridgingGameRouter() {
  const { state } = useBridgingSenderState();

  switch (state.screen) {
    case 'intro':
      return <BridgingIntroScreen />;
    case 'anchor-target':
      return <AnchorTargetScreen anchor={state.anchor} target={state.target} />;
    case 'clues':
      return (
        <BridgingCluesScreen
          gameId={state.gameId}
          anchor={state.anchor}
          target={state.target}
        />
      );
    case 'share':
      return (
        <BridgingShareScreen
          gameId={state.gameId}
          anchor={state.anchor}
          target={state.target}
          clues={state.clues}
          divergence={state.divergence}
          shareCode={state.shareCode}
        />
      );
    case 'results':
      return <BridgingResultsScreen game={state.game} />;
    default:
      return <BridgingIntroScreen />;
  }
}

export default function BridgingGame() {
  return (
    <BridgingSenderProvider>
      <Navigation instrumentId="INS-001.2" instrumentTitle="BRIDGING" />
      <BridgingGameRouter />
    </BridgingSenderProvider>
  );
}
