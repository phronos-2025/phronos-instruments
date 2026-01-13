/**
 * Clue Input Component
 * 
 * Input field for clues with status indicator.
 * Shows warning if clue matches noise floor (predictable), checkmark otherwise.
 */

import React from 'react';
import type { NoiseFloorWord } from '../../lib/api';

interface ClueInputProps {
  number: number;
  value: string;
  onChange: (value: string) => void;
  noiseFloor?: NoiseFloorWord[];
}

export const ClueInput: React.FC<ClueInputProps> = ({
  number,
  value,
  onChange,
  noiseFloor = []
}) => {
  const trimmedValue = value.trim();
  const hasValue = trimmedValue !== '';
  
  // Check if clue matches any noise floor word (case-insensitive)
  const isInNoiseFloor = hasValue && noiseFloor.some(
    item => item.word.toLowerCase() === trimmedValue.toLowerCase()
  );
  
  const statusClass = hasValue 
    ? (isInNoiseFloor ? 'warning' : 'valid')
    : '';
  
  const statusIcon = hasValue
    ? (isInNoiseFloor ? '⚠' : '✓')
    : '';
  
  return (
    <div className="clue-row">
      <span className="clue-number">{number}</span>
      <input
        type="text"
        className={`clue-input ${statusClass}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter clue..."
        autoComplete="off"
        spellCheck="false"
      />
      <span className={`clue-status ${statusClass}`}>
        {statusIcon}
      </span>
    </div>
  );
};
