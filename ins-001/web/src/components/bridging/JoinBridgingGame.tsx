/**
 * Join Bridging Game Component - INS-001.2 Recipient Flow (V2)
 *
 * State machine router for recipient screens.
 * V2: Recipients build their own bridge instead of guessing words.
 */

import React from 'react';
import {
  BridgingRecipientProvider,
  useBridgingRecipientState,
} from '../../lib/bridging-state';
import { Navigation } from '../ui/Navigation';
import { BridgingJoinScreen } from './screens/BridgingJoinScreen';
import { BridgingComparisonScreen } from './screens/BridgingComparisonScreen';

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
            href="/ins-001/ins-001-2/"
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

    case 'build-bridge':
      return (
        <BridgingJoinScreen
          shareCode={shareCode}
          gameId={state.gameId}
          anchor={state.anchor}
          target={state.target}
          senderStepCount={state.senderStepCount}
        />
      );

    case 'comparison':
      return (
        <BridgingComparisonScreen
          anchor={state.anchor}
          target={state.target}
          // Sender (Them)
          senderSteps={state.senderSteps}
          senderRelevance={state.senderRelevance}
          senderDivergence={state.senderDivergence}
          // Recipient (You)
          recipientSteps={state.recipientSteps}
          recipientRelevance={state.recipientRelevance}
          recipientDivergence={state.recipientDivergence}
          // Bridge comparison
          bridgeSimilarity={state.bridgeSimilarity}
          // Haiku baseline
          haikuClues={state.haikuClues}
          haikuRelevance={state.haikuRelevance}
          haikuDivergence={state.haikuDivergence}
          // Statistical baseline
          lexicalBridge={state.lexicalBridge}
          lexicalRelevance={state.lexicalRelevance}
          lexicalDivergence={state.lexicalDivergence}
        />
      );

    default:
      return <BridgingJoinScreen shareCode={shareCode} />;
  }
}

export default function JoinBridgingGame({ shareCode }: JoinBridgingGameProps) {
  return (
    <BridgingRecipientProvider>
      <Navigation instrumentId="INS-001.2" instrumentTitle="COMMON GROUND" />
      <BridgingRecipientRouter shareCode={shareCode} />
    </BridgingRecipientProvider>
  );
}
