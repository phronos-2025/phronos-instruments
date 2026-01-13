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
    // Use setTimeout to ensure DOM is ready
    setTimeout(() => {
      const statusEl = document.querySelector(`[data-testid="clue-status-${number}"]`);
      const inputEl = document.querySelector(`.clue-row:nth-child(${number}) .clue-input`) || 
                      document.querySelector(`.clue-input[value="${value.substring(0, 5)}"]`);
      const computedStyle = inputEl ? window.getComputedStyle(inputEl) : null;
      const statusStyle = statusEl ? window.getComputedStyle(statusEl) : null;
      const logData = {
        number,
        value: value.substring(0, 10),
        trimmedValue: trimmedValue.substring(0, 10),
        isValid,
        hasInputEl: !!inputEl,
        hasStatusEl: !!statusEl,
        statusText: statusEl?.textContent?.trim() || 'EMPTY',
        statusInnerHTML: statusEl?.innerHTML || 'EMPTY',
        statusDisplay: statusStyle?.display || 'N/A',
        statusVisibility: statusStyle?.visibility || 'N/A',
        statusOpacity: statusStyle?.opacity || 'N/A',
        statusWidth: statusStyle?.width || 'N/A',
        statusColor: statusStyle?.color || 'N/A',
        statusFontSize: statusStyle?.fontSize || 'N/A',
        backgroundColor: computedStyle?.backgroundColor || 'N/A',
        fontSize: computedStyle?.fontSize || 'N/A'
      };
      console.log(`[DEBUG] ClueInput #${number}:`, logData);
      // Also log to help debug
      if (isValid && !statusEl?.textContent?.trim()) {
        console.warn(`[WARN] ClueInput #${number}: isValid=true but status text is empty!`);
      }
    }, 100);
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
      <span className={`clue-status ${isValid ? 'valid' : ''}`} data-testid={`clue-status-${number}`}>
        {isValid ? '✓ valid' : ''}
      </span>
    </div>
  );
};
