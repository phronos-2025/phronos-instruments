/**
 * Share Screen
 * 
 * Matches mockup: divergence score in gold panel, two-option share grid, share link section
 */

import React, { useState } from 'react';
import { useGameState } from '../../lib/state';
import { api } from '../../lib/api';
import { Panel } from '../ui/Panel';
import { Button } from '../ui/Button';
import { ProgressBar } from '../ui/ProgressBar';
import { ShareOptions } from '../ui/ShareOptions';
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
  const [showShareLink, setShowShareLink] = useState(false);
  
  const handleCreateShareLink = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await api.share.createToken(gameId);
      setShareToken(response.token);
      setShareUrl(response.share_url);
      setShowShareLink(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create share link');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleClaudeClick = async () => {
    try {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/d2fccf00-3424-45da-b940-77d949e2891b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ShareScreen.tsx:50',message:'Fetching game data',data:{gameId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
      // #endregion
      
      const game = await api.games.get(gameId);
      
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/d2fccf00-3424-45da-b940-77d949e2891b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ShareScreen.tsx:54',message:'Game data received from API',data:{hasGuessSimilarities:!!game.guess_similarities,guessSimilaritiesLength:game.guess_similarities?.length,guessesLength:game.guesses?.length,recipientType:game.recipient_type},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
      // #endregion
      
      dispatch({ type: 'GAME_COMPLETED', game });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load results');
    }
  };
  
  const handleFriendClick = () => {
    if (!shareUrl) {
      handleCreateShareLink();
    } else {
      setShowShareLink(true);
    }
  };
  
  const divergenceInterpretation = 
    divergence < 0.3 ? 'Conventional' :
    divergence < 0.6 ? 'Moderate' :
    'High Divergence';
  
  const divergenceDescription = 
    divergence < 0.3 ? 'Your clues align closely with predictable associations.' :
    divergence < 0.6 ? 'Your clues show moderate deviation from predictable associations.' :
    'Your clues venture significantly from predictable associations.';
  
  return (
    <div>
      <ProgressBar currentStep={3} />
      
      <p className="subtitle">
        <span className="id">INS-001</span> · Step 3 of 3
      </p>
      <h1 className="title">Who will guess?</h1>
      
      <p className="description">
        Your divergence score is ready. Now choose who will attempt to decode your associations.
      </p>
      
      <Panel className="" style={{ borderColor: 'var(--gold)' }}>
        <div className="panel-header">
          <span className="panel-title">Your Divergence Score</span>
          <span className="panel-meta">Calculated</span>
        </div>
        <div className="panel-content" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '3rem', fontWeight: '300', color: 'var(--gold)' }}>
            {divergence.toFixed(2)}
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-light)' }}>
              {divergenceInterpretation}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--faded)' }}>
              {divergenceDescription}
            </div>
          </div>
        </div>
      </Panel>
      
      <ShareOptions
        onClaudeClick={handleClaudeClick}
        onFriendClick={handleFriendClick}
      />
      
      {showShareLink && shareUrl && (
        <div style={{ marginTop: 'var(--space-lg)', borderTop: '1px solid var(--faded-light)', paddingTop: 'var(--space-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 'var(--space-xs)' }}>
            <p className="mono-label" style={{ margin: 0 }}>Share Link</p>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--active)' }}>
              ● Link Active (expires 7d)
            </span>
          </div>
          
          <ShareLinkBox url={shareUrl} />
          
          <div style={{ marginTop: 'var(--space-md)', background: 'var(--faded-ultra)', padding: 'var(--space-sm)', border: '1px solid var(--faded-light)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-light)', flex: 1, minWidth: '180px' }}>
                <strong style={{ color: 'var(--gold)' }}>Don't miss the results.</strong><br />
                <span style={{ color: 'var(--faded)' }}>Create an account to be notified when your friend guesses.</span>
              </div>
              <Button
                variant="secondary"
                style={{ fontSize: '0.65rem', padding: '6px 12px', whiteSpace: 'nowrap' }}
                onClick={() => {
                  // TODO: Trigger account creation modal
                  console.log('Notify Me clicked');
                }}
              >
                Notify Me
              </Button>
            </div>
          </div>
          
          <div style={{ marginTop: 'var(--space-md)', textAlign: 'right' }}>
            <Button
              variant="ghost"
              onClick={async () => {
                try {
                  const game = await api.games.get(gameId);
                  dispatch({ type: 'GAME_COMPLETED', game });
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Failed to load results');
                }
              }}
            >
              View Session Dashboard →
            </Button>
          </div>
        </div>
      )}
      
      {error && (
        <div style={{ color: 'var(--alert)', marginTop: '1rem', fontSize: 'var(--text-sm)' }}>
          ◈ {error}
        </div>
      )}
      
      <div className="btn-group">
        <Button
          variant="ghost"
          onClick={() => dispatch({ type: 'BACK' })}
        >
          ← Back
        </Button>
      </div>
    </div>
  );
};
