/**
 * Clue Input Component
 * 
 * Input field for clues with validation status display.
 * Accepts any word - validation is based on whether field is filled.
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
  const trimmedValue = value.trim();
  const isValid = trimmedValue !== '';
  
  return (
    <div className="clue-row">
      <span className="clue-number">{number}</span>
      <input
        type="text"
        className={`clue-input ${isValid ? 'valid' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter clue..."
        autoComplete="off"
        spellCheck="false"
      />
      <span className={`clue-status ${isValid ? 'valid' : ''}`}>
        {isValid ? '✓ valid' : ''}
      </span>
    </div>
  );
};
