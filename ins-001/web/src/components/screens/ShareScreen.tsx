/**
 * Results loading screen
 *
 * After clues are submitted the LLM game is already scored server-side. This
 * transitional screen loads the completed game and advances to the results.
 * (Formerly the "who will guess?" share step, removed with multiplayer.)
 */

import React, { useEffect, useState } from 'react';
import { useGameState } from '../../lib/state';
import { api } from '../../lib/api';

interface ShareScreenProps {
  gameId: string;
  divergence: number;
}

export const ShareScreen: React.FC<ShareScreenProps> = ({ gameId }) => {
  const { dispatch } = useGameState();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const game = await api.games.get(gameId);
        if (active) dispatch({ type: 'GAME_COMPLETED', game });
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load results');
      }
    })();
    return () => {
      active = false;
    };
  }, [gameId]);

  return (
    <div>
      <p className="subtitle">
        <span className="id">INS-001.1</span> · Scoring
      </p>
      <h1 className="title">Reading your signal…</h1>
      {error ? (
        <div style={{ color: 'var(--alert)', marginTop: '1rem', fontSize: 'var(--text-sm)' }}>
          ◈ {error}
        </div>
      ) : (
        <p className="description">Computing divergence and relevance.</p>
      )}
    </div>
  );
};
