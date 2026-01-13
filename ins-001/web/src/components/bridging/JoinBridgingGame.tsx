/**
 * Join Bridging Game Component - INS-001.2 Recipient Flow
 *
 * State machine router for recipient screens.
 */

import React from 'react';
import {
  BridgingRecipientProvider,
  useBridgingRecipientState,
} from '../../lib/bridging-state';
import { Navigation } from '../ui/Navigation';
import { BridgingJoinScreen } from './screens/BridgingJoinScreen';
import { BridgingGuessResultsScreen } from './screens/BridgingGuessResultsScreen';

interface JoinBridgingGameProps {
  shareCode: string;
}

function BridgingRecipientRouter({ shareCode }: { shareCode: string }) {
  const { state } = useBridgingRecipientState();

  switch (state.screen) {
    case 'loading':
      return <BridgingJoinScreen shareCode={shareCode} />;
    case 'error':
      return (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p className="subtitle">
            <span className="id">INS-001.2</span> · Error
          </p>
          <h1 className="title">Something went wrong.</h1>
          <p
            style={{
              color: 'var(--alert)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
            }}
          >
            {state.message}
          </p>
          <a
            href="/ins-001-2"
            style={{
              display: 'inline-block',
              marginTop: 'var(--space-lg)',
              color: 'var(--gold)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            Create your own bridge →
          </a>
        </div>
      );
    case 'join':
      return (
        <BridgingJoinScreen
          shareCode={shareCode}
          gameId={state.gameId}
          clues={state.clues}
        />
      );
    case 'results':
      return (
        <BridgingGuessResultsScreen
          clues={state.clues}
          guessedAnchor={state.guessedAnchor}
          guessedTarget={state.guessedTarget}
          trueAnchor={state.trueAnchor}
          trueTarget={state.trueTarget}
          reconstructionScore={state.reconstructionScore}
          anchorSimilarity={state.anchorSimilarity}
          targetSimilarity={state.targetSimilarity}
          orderSwapped={state.orderSwapped}
          exactAnchorMatch={state.exactAnchorMatch}
          exactTargetMatch={state.exactTargetMatch}
        />
      );
    default:
      return <BridgingJoinScreen shareCode={shareCode} />;
  }
}

export default function JoinBridgingGame({ shareCode }: JoinBridgingGameProps) {
  return (
    <BridgingRecipientProvider>
      <Navigation instrumentId="INS-001.2" instrumentTitle="BRIDGING" />
      <BridgingRecipientRouter shareCode={shareCode} />
    </BridgingRecipientProvider>
  );
}
