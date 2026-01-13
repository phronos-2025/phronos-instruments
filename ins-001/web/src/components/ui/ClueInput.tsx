/**
 * Clue Input Component
 * 
 * Simple input field for clues or guesses.
 * No validation - accepts any word.
 */

import React from 'react';

interface ClueInputProps {
  number: number;
  value: string;
  onChange: (value: string) => void;
}

export const ClueInput: React.FC<ClueInputProps> = ({
  number,
  value,
  onChange
}) => {
  return (
    <div className="clue-row">
      <span className="clue-number">{number}</span>
      <input
        type="text"
        className="clue-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter clue..."
        autoComplete="off"
        spellCheck="false"
      />
    </div>
  );
};
