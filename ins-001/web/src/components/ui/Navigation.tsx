/**
 * Fixed Navigation Component
 *
 * Matches reference: Phronos logo on left, INS-001.1 SIGNAL on right
 */

import React from 'react';
import { PhronosLogo } from './PhronosLogo';

interface NavigationProps {
  instrumentId?: string;
  instrumentTitle?: string;
}

export const Navigation: React.FC<NavigationProps> = ({
  instrumentId = 'INS-001.1',
  instrumentTitle = 'SIGNAL'
}) => {
  return (
    <nav className="nav">
      <a href="https://phronos.org" className="nav-brand">
        <PhronosLogo size={31} theme="dark" />
        <span className="nav-wordmark">Phronos</span>
      </a>
      <div className="nav-status">
        <span className="status-dot"></span>
        <span className="status-text">{instrumentId} {instrumentTitle}</span>
      </div>
    </nav>
  );
};
