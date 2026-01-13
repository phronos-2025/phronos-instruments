/**
 * Fixed Navigation Component
 * 
 * Matches mockup: Phronos logo on left, INS-001 ACTIVE on right
 */

import React from 'react';
import { PhronosLogo } from './PhronosLogo';

interface NavigationProps {
  instrumentId?: string;
  instrumentTitle?: string;
}

export const Navigation: React.FC<NavigationProps> = ({
  instrumentId = 'INS-001',
  instrumentTitle = 'ACTIVE'
}) => {
  return (
    <nav className="nav-fixed">
      <div className="nav-left">
        <a href="/" className="nav-brand">
          <span className="nav-logo-mark">
            <PhronosLogo size={24} />
          </span>
          <span className="nav-wordmark">Phronos</span>
        </a>
      </div>
      <div className="nav-right">
        <span className="nav-instrument-status">
          <span className="nav-instrument-text">{instrumentId} {instrumentTitle}</span>
          <span className="nav-status-dot"></span>
        </span>
      </div>
    </nav>
  );
};
