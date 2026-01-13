/**
 * Clue Input Component
 * 
 * Input field for clues with validation status display.
 * Accepts any word - validation is based on whether field is filled.
 */

import React, { useEffect } from 'react';

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
  
  // #region agent log
  useEffect(() => {
    const inputEl = document.querySelector(`.clue-row:nth-child(${number}) .clue-input`);
    const statusEl = document.querySelector(`.clue-row:nth-child(${number}) .clue-status`);
    const computedStyle = inputEl ? window.getComputedStyle(inputEl) : null;
    const logData = {
      number,
      hasValue: !!value,
      isValid,
      hasInputEl: !!inputEl,
      hasStatusEl: !!statusEl,
      backgroundColor: computedStyle?.backgroundColor || 'N/A',
      fontSize: computedStyle?.fontSize || 'N/A',
      statusText: statusEl?.textContent || 'N/A'
    };
    if (number === 1) console.log('[DEBUG] ClueInput CSS:', logData);
  }, [number, value, isValid]);
  // #endregion
  
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
