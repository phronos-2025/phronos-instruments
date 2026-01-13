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
    fetch('http://127.0.0.1:7244/ingest/d2fccf00-3424-45da-b940-77d949e2891b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ClueInput.tsx:25',message:'ClueInput rendered',data:{number,hasValue:!!value,isValid,hasInputEl:!!inputEl,hasStatusEl:!!statusEl,backgroundColor:computedStyle?.backgroundColor||'N/A',fontSize:computedStyle?.fontSize||'N/A',statusText:statusEl?.textContent||'N/A'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
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
