/**
 * Fixed Navigation Component
 * 
 * Matches reference: Phronos logo on left, INS-001 ACTIVE on right
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
    <nav className="nav">
      <a href="https://phronos.org" className="nav-brand">
        <span className="logo-mark">
          <PhronosLogo size={24} />
        </span>
        <span className="nav-wordmark">Phronos</span>
      </a>
      <div className="nav-status">
        <span className="status-dot"></span>
        <span className="status-text">{instrumentId} {instrumentTitle}</span>
      </div>
    </nav>
  );
};
