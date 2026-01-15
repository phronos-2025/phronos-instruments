/**
 * Fixed Navigation Component
 *
 * Full navigation with Dispatches, Library, Methods, Instruments links
 * Plus instrument status indicator on the right
 */

import React, { useState, useEffect } from 'react';
import { PhronosLogo } from './PhronosLogo';

interface NavigationProps {
  instrumentId?: string;
  instrumentTitle?: string;
}

export const Navigation: React.FC<NavigationProps> = ({
  instrumentId = 'INS-001.1',
  instrumentTitle = 'SIGNAL'
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const handleMobileMenuToggle = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const handleLinkClick = () => {
    setMobileMenuOpen(false);
  };

  return (
    <>
      <nav className="nav">
        <a href="https://phronos.org" className="nav-brand">
          <PhronosLogo size={31} theme="dark" />
          <span className="nav-wordmark">Phronos</span>
        </a>

        <ul className="nav-links">
          <li><a href="https://phronos.org/dispatches" className="nav-link">Dispatches</a></li>
          <li><span className="nav-link nav-link-disabled">Library</span></li>
          <li><a href="https://phronos.org/methods" className="nav-link">Methods</a></li>
          <li><a href="https://instruments.phronos.org" className="nav-link nav-link-active">Instruments</a></li>
        </ul>

        <div className="nav-status">
          <span className="status-dot"></span>
          <span className="status-text">{instrumentId} {instrumentTitle}</span>
        </div>

        <button
          className="nav-hamburger"
          aria-label="Open menu"
          onClick={handleMobileMenuToggle}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </nav>

      {/* Mobile Menu */}
      <div className={`nav-mobile-menu ${mobileMenuOpen ? 'is-open' : ''}`}>
        <div className="nav-mobile-header">
          <a href="https://phronos.org" className="nav-brand">
            <PhronosLogo size={31} theme="dark" />
            <span className="nav-wordmark">Phronos</span>
          </a>
          <button
            className="nav-mobile-close"
            aria-label="Close menu"
            onClick={handleMobileMenuToggle}
          />
        </div>

        <div className="nav-mobile-links">
          <a href="https://phronos.org/dispatches" className="nav-mobile-link" onClick={handleLinkClick}>
            Dispatches
          </a>
          <span className="nav-mobile-link nav-mobile-link-disabled">
            Library
            <span className="soon-label">(soon)</span>
          </span>
          <a href="https://phronos.org/methods" className="nav-mobile-link" onClick={handleLinkClick}>
            Methods
          </a>
          <a href="https://instruments.phronos.org" className="nav-mobile-link nav-mobile-link-active" onClick={handleLinkClick}>
            Instruments
          </a>
        </div>

        <div className="nav-mobile-status">
          <span className="status-dot"></span>
          <span className="status-text">{instrumentId} {instrumentTitle}</span>
        </div>
      </div>
    </>
  );
};
