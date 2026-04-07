/**
 * Study Navigation — Simplified navbar for study pages.
 * Phronos logo on the left, authentication on the right.
 * No nav links (Dispatches, Library, Methods, Instruments).
 */

import React, { useState } from 'react';
import { PhronosLogo } from '../ui/PhronosLogo';
import { useAuth } from '../auth/AuthProvider';
import { MagicLinkModal } from '../auth/MagicLinkModal';

export const StudyNavigation: React.FC = () => {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { user } = useAuth();

  const isRegistered = user?.email && !user?.is_anonymous;
  const displayEmail = user?.email
    ? user.email.length > 20
      ? user.email.slice(0, 17) + '...'
      : user.email
    : null;

  return (
    <>
      <nav className="nav">
        <a href="https://phronos.org" className="nav-brand">
          <PhronosLogo size={31} theme="dark" />
          <span className="nav-wordmark">Phronos</span>
        </a>

        <div className="nav-right">
          {isRegistered ? (
            <div className="nav-user">
              <a href="/profile" className="nav-user-email" title={`${user?.email} - View Profile`}>
                {displayEmail}
              </a>
            </div>
          ) : (
            <button
              className="nav-subscribe nav-subscribe-desktop"
              onClick={() => setShowAuthModal(true)}
            >
              Authenticate
            </button>
          )}
        </div>
      </nav>

      <MagicLinkModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </>
  );
};
