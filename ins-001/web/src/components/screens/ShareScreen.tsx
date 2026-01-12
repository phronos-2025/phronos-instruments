/**
 * Share Screen
 * 
 * Divergence score display, choose Claude or friend
 */

import React, { useState } from 'react';
import { useGameState } from '../../lib/state';
import { api } from '../../lib/api';
import { Panel } from '../ui/Panel';
import { Button } from '../ui/Button';
import { ProgressBar } from '../ui/ProgressBar';
import { ScoreCard } from '../ui/ScoreCard';
import { ShareLinkBox } from '../ui/ShareLinkBox';

interface ShareScreenProps {
  gameId: string;
  divergence: number;
}

export const ShareScreen: React.FC<ShareScreenProps> = ({
  gameId,
  divergence
}) => {
  const { dispatch } = useGameState();
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleCreateShareLink = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await api.share.createToken(gameId);
      setShareToken(response.token);
      setShareUrl(response.share_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create share link');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleViewResults = async () => {
    try {
      const game = await api.games.get(gameId);
      dispatch({ type: 'GAME_COMPLETED', game });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load results');
    }
  };
  
  const divergenceInterpretation = 
    divergence < 0.3 ? 'Conventional' :
    divergence < 0.6 ? 'Moderate' :
    'Creative';
  
  return (
    <div>
      <ProgressBar currentStep={3} />
      
      <Panel title="Your Divergence Score">
        <ScoreCard
          label="Divergence"
          value={divergence}
          interpretation={divergenceInterpretation}
        />
        
        <p style={{ marginTop: '1.5rem', color: 'var(--faded)', fontSize: 'var(--text-sm)' }}>
          This measures how far your clues ventured from predictable associations.
          Higher scores indicate more creative, unexpected connections.
        </p>
      </Panel>
      
      <Panel title="Share Your Game">
        <p style={{ marginBottom: '1rem', color: 'var(--faded)' }}>
          Share with a friend to test how well your associations communicate, or view results from the AI guesser.
        </p>
        
        {!shareUrl ? (
          <div>
            <Button
              variant="primary"
              onClick={handleCreateShareLink}
              disabled={isLoading}
            >
              {isLoading ? 'Creating...' : 'Create Share Link'}
            </Button>
          </div>
        ) : (
          <div>
            <ShareLinkBox url={shareUrl} />
            <p style={{ marginTop: '1rem', fontSize: 'var(--text-xs)', color: 'var(--faded)' }}>
              Share this link with a friend. They'll see your clues and try to guess your word.
            </p>
          </div>
        )}
        
        <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--faded-ultra)' }}>
          <Button
            variant="secondary"
            onClick={handleViewResults}
          >
            View Results
          </Button>
        </div>
        
        {error && (
          <div style={{ color: 'var(--alert)', marginTop: '1rem', fontSize: 'var(--text-sm)' }}>
            ◈ {error}
          </div>
        )}
      </Panel>
    </div>
  );
};
