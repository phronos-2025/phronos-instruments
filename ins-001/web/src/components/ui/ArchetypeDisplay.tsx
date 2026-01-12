/**
 * Archetype Display Component
 * 
 * Centered badge with gold accent
 */

import React from 'react';

interface ArchetypeDisplayProps {
  archetype: string;
}

export const ArchetypeDisplay: React.FC<ArchetypeDisplayProps> = ({ archetype }) => {
  return (
    <div className="archetype-display">
      <div className="archetype-label">Preliminary Classification</div>
      <div className="archetype-name">{archetype}</div>
    </div>
  );
};
