/**
 * Nav Auth Button
 *
 * Shows authenticate button or user email in navigation
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './AuthProvider';
import { MagicLinkModal } from './MagicLinkModal';

interface NavAuthButtonProps {
  variant?: 'desktop' | 'mobile';
}

const NavAuthButtonInner: React.FC<NavAuthButtonProps> = ({ variant = 'desktop' }) => {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);

  // Check if user is registered (has email, not anonymous)
  const isRegistered = user?.email && !user?.is_anonymous;

  if (isRegistered) {
    // Show user email as link to profile
    if (variant === 'mobile') {
      return (
        <div className="nav-mobile-auth-user">
          <a href="/profile" className="nav-mobile-auth-email nav-profile-link">
            {user?.email}
          </a>
        </div>
      );
    }

    return (
      <div className="nav-auth-user">
        <a href="/profile" className="nav-auth-email nav-profile-link" title={`${user?.email} - View Profile`}>
          {user?.email && user.email.length > 20 ? user.email.slice(0, 17) + '...' : user?.email}
        </a>
      </div>
    );
  }

  // Show authenticate button
  if (variant === 'mobile') {
    return (
      <>
        <button
          className="nav-mobile-subscribe"
          onClick={() => setShowModal(true)}
        >
          Authenticate
        </button>
        <MagicLinkModal isOpen={showModal} onClose={() => setShowModal(false)} />
      </>
    );
  }

  return (
    <>
      <button
        className="nav-subscribe nav-subscribe-desktop"
        onClick={() => setShowModal(true)}
      >
        Authenticate
      </button>
      <MagicLinkModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </>
  );
};

// Wrap with AuthProvider for standalone use (e.g., in Astro components)
export const NavAuthButton: React.FC<NavAuthButtonProps> = (props) => {
  return (
    <AuthProvider>
      <NavAuthButtonInner {...props} />
    </AuthProvider>
  );
};
