/**
 * Profile Page Component
 *
 * Displays user's cognitive profile, game history, and data rights information.
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '../auth/AuthProvider';
import { MagicLinkModal } from '../auth/MagicLinkModal';
import { Panel } from '../ui/Panel';
import { api } from '../../lib/api';
import type { UserResponse, ProfileResponse, GameHistoryResponse } from '../../lib/api';

const ProfilePageInner: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [userData, setUserData] = useState<UserResponse | null>(null);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [gameHistory, setGameHistory] = useState<GameHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const isRegistered = user?.email && !user?.is_anonymous;

  useEffect(() => {
    const fetchData = async () => {
      if (authLoading) return;

      try {
        setLoading(true);
        setError(null);

        const [userRes, profileRes, historyRes] = await Promise.all([
          api.users.getMe(),
          api.users.getProfile(),
          api.users.getGameHistory(50, 0),
        ]);

        setUserData(userRes);
        setProfile(profileRes);
        setGameHistory(historyRes);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [authLoading]);

  if (authLoading || loading) {
    return (
      <div className="profile-loading">
        <p className="loading-text">Loading profile...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-error">
        <Panel>
          <p className="error-text">Error: {error}</p>
          <button className="retry-button" onClick={() => window.location.reload()}>
            Retry
          </button>
        </Panel>
      </div>
    );
  }

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatScore = (score: number | undefined | null) => {
    if (score === undefined || score === null) return '--';
    return score.toFixed(1);
  };

  return (
    <div className="profile-page">
      {/* Header */}
      <section className="profile-header">
        <h1 className="profile-title">Your Profile</h1>
        {isRegistered ? (
          <div className="profile-identity">
            <span className="profile-email">{user?.email}</span>
            <span className="profile-member-since">
              Member since {formatDate(userData?.created_at)}
            </span>
          </div>
        ) : (
          <div className="profile-anonymous">
            <p className="anonymous-text">
              You're using an anonymous session. Register to save your cognitive profile across devices.
            </p>
            <button className="register-button" onClick={() => setShowAuthModal(true)}>
              Register with Email
            </button>
          </div>
        )}
      </section>

      {/* Profile Stats */}
      <Panel title="Cognitive Profile" meta={profile?.profile_ready ? 'Ready' : `${profile?.games_until_ready || 15} games until ready`}>
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-label">Games Played</span>
            <span className="stat-value">{profile?.games_played || 0}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Signal Games</span>
            <span className="stat-value">{profile?.radiation_games || 0}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Common Ground</span>
            <span className="stat-value">{profile?.bridging_games || 0}</span>
          </div>
        </div>

        {profile && profile.games_played > 0 && (
          <>
            <div className="stats-divider" />
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-label">Avg Divergence</span>
                <span className="stat-value">{formatScore(profile.divergence_mean)}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Consistency</span>
                <span className="stat-value">
                  {profile.consistency_score !== null && profile.consistency_score !== undefined
                    ? `${(profile.consistency_score * 100).toFixed(0)}%`
                    : '--'}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">LLM Convergence</span>
                <span className="stat-value">{formatScore(profile.llm_convergence_mean)}</span>
              </div>
            </div>
          </>
        )}

        {!profile?.profile_ready && (
          <p className="profile-progress-text">
            Play {profile?.games_until_ready || 15} more games to unlock your full cognitive profile.
          </p>
        )}
      </Panel>

      {/* Game History */}
      <Panel title="Game History" meta={`${gameHistory?.total || 0} sessions`}>
        {gameHistory && gameHistory.games.length > 0 ? (
          <div className="history-list">
            {gameHistory.games.map((game) => (
              <div key={game.game_id} className="history-item">
                <div className="history-item-header">
                  <span className="history-type">
                    {game.game_type === 'radiation' ? 'Signal' : 'Common Ground'}
                  </span>
                  <span className="history-date">{formatDate(game.created_at)}</span>
                </div>
                <div className="history-item-details">
                  <span className="history-seed">
                    {game.game_type === 'radiation'
                      ? game.seed_word
                      : `${game.anchor_word} → ${game.target_word}`}
                  </span>
                  <span className="history-scores">
                    {game.divergence !== null && game.divergence !== undefined && (
                      <span className="score-badge">Div: {formatScore(game.divergence)}</span>
                    )}
                    {game.relevance !== null && game.relevance !== undefined && (
                      <span className="score-badge">Rel: {formatScore(game.relevance * 100)}%</span>
                    )}
                  </span>
                </div>
                <span className={`history-status status-${game.status}`}>
                  {game.status === 'completed' ? 'Completed' : game.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="no-games-text">No games played yet. Start with Signal or Common Ground.</p>
        )}
      </Panel>

      {/* Data & Privacy */}
      <Panel title="Data & Privacy">
        <div className="data-section">
          {userData?.terms_accepted_at && (
            <div className="consent-status">
              <span className="consent-label">Terms Accepted</span>
              <span className="consent-date">{formatDate(userData.terms_accepted_at)}</span>
            </div>
          )}

          <div className="data-rights">
            <h4 className="data-rights-title">Your Data Rights</h4>
            <p className="data-rights-text">
              To request a copy of your data or request deletion, contact{' '}
              <a href="mailto:it-admin@phronos.org" className="data-email">
                it-admin@phronos.org
              </a>
            </p>
          </div>
        </div>
      </Panel>

      <MagicLinkModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
};

// Wrap with AuthProvider for standalone use
export const ProfilePage: React.FC = () => {
  return (
    <AuthProvider>
      <ProfilePageInner />
    </AuthProvider>
  );
};

// Styles
const styles = `
  .profile-page {
    font-family: var(--font-mono);
  }

  .profile-loading,
  .profile-error {
    text-align: center;
    padding: var(--space-2xl) 0;
  }

  .loading-text {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--faded);
  }

  .error-text {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--error, #ff6b6b);
    margin-bottom: var(--space-md);
  }

  .retry-button {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--gold);
    background: transparent;
    border: 1px solid var(--gold);
    padding: var(--space-sm) var(--space-md);
    cursor: pointer;
    transition: all var(--transition-default);
  }

  .retry-button:hover {
    background: var(--gold);
    color: var(--bg-deep);
  }

  /* Header */
  .profile-header {
    margin-bottom: var(--space-xl);
  }

  .profile-title {
    font-family: var(--font-serif);
    font-weight: 300;
    font-size: clamp(2rem, 5vw, 2.5rem);
    letter-spacing: -0.02em;
    color: var(--text-light);
    margin-bottom: var(--space-md);
  }

  .profile-identity {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .profile-email {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--gold);
  }

  .profile-member-since {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--faded);
  }

  .profile-anonymous {
    background: rgba(var(--gold-rgb, 201, 160, 99), 0.1);
    border: 1px solid var(--gold-dim);
    padding: var(--space-md);
  }

  .anonymous-text {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    color: var(--faded);
    margin-bottom: var(--space-md);
  }

  .register-button {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--bg-deep);
    background: var(--gold);
    border: 1px solid var(--gold);
    padding: var(--space-sm) var(--space-md);
    cursor: pointer;
    transition: all var(--transition-default);
  }

  .register-button:hover {
    box-shadow: var(--shadow-button-hover);
    transform: translate(-2px, -2px);
  }

  /* Stats Grid */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-md);
  }

  @media (max-width: 600px) {
    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .stat-label {
    font-size: var(--text-xs);
    color: var(--faded);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .stat-value {
    font-size: 1.25rem;
    color: var(--text-light);
  }

  .stats-divider {
    height: 1px;
    background: var(--faded-light);
    margin: var(--space-md) 0;
  }

  .profile-progress-text {
    font-size: var(--text-xs);
    color: var(--faded);
    margin-top: var(--space-md);
    font-style: italic;
  }

  /* Game History */
  .history-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .history-item {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--faded-light);
    padding: var(--space-sm) var(--space-md);
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .history-item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .history-type {
    font-size: var(--text-xs);
    color: var(--gold);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .history-date {
    font-size: var(--text-xs);
    color: var(--faded);
  }

  .history-item-details {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-xs);
  }

  .history-seed {
    font-size: var(--text-sm);
    color: var(--text-light);
  }

  .history-scores {
    display: flex;
    gap: var(--space-xs);
  }

  .score-badge {
    font-size: 10px;
    color: var(--faded);
    background: rgba(255, 255, 255, 0.05);
    padding: 2px 6px;
  }

  .history-status {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .status-completed {
    color: var(--active);
  }

  .status-pending_clues,
  .status-pending_guess {
    color: var(--gold);
  }

  .status-expired {
    color: var(--faded);
  }

  .no-games-text {
    font-size: var(--text-sm);
    color: var(--faded);
    font-style: italic;
  }

  /* Data & Privacy */
  .data-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  .consent-status {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: var(--space-md);
    border-bottom: 1px solid var(--faded-light);
  }

  .consent-label {
    font-size: var(--text-sm);
    color: var(--text-light);
  }

  .consent-date {
    font-size: var(--text-xs);
    color: var(--active);
  }

  .data-rights-title {
    font-size: var(--text-sm);
    color: var(--text-light);
    margin-bottom: var(--space-xs);
    font-weight: normal;
  }

  .data-rights-text {
    font-size: var(--text-xs);
    color: var(--faded);
    line-height: 1.6;
  }

  .data-email {
    color: var(--gold);
    text-decoration: none;
    border-bottom: 1px dotted var(--gold);
  }

  .data-email:hover {
    border-bottom-style: solid;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleId = 'profile-page-styles';
  if (!document.getElementById(styleId)) {
    const styleElement = document.createElement('style');
    styleElement.id = styleId;
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
  }
}
