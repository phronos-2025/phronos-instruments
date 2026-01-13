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
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/d2fccf00-3424-45da-b940-77d949e2891b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ClueInput.tsx:24',message:'Component render',data:{number,value,valueLength:value.length,noiseFloorLength:noiseFloor.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  
  const trimmedValue = value.trim();
  const hasValue = trimmedValue !== '';
  
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/d2fccf00-3424-45da-b940-77d949e2891b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ClueInput.tsx:29',message:'Before noise floor check',data:{trimmedValue,hasValue,noiseFloorLength:noiseFloor.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
  // #endregion
  
  // Check if clue matches any noise floor word (case-insensitive)
  const isInNoiseFloor = hasValue && noiseFloor.some(
    item => item.word.toLowerCase() === trimmedValue.toLowerCase()
  );
  
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/d2fccf00-3424-45da-b940-77d949e2891b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ClueInput.tsx:35',message:'After noise floor check',data:{isInNoiseFloor,hasValue},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  
  const statusClass = hasValue 
    ? (isInNoiseFloor ? 'warning' : 'valid')
    : '';
  
  const statusIcon = hasValue
    ? (isInNoiseFloor ? '⚠' : '✓')
    : '';
  
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/d2fccf00-3424-45da-b940-77d949e2891b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ClueInput.tsx:48',message:'Status calculation result',data:{statusClass,statusIcon,hasValue,isInNoiseFloor},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  return (
    <div className="clue-row">
      <span className="clue-number">{number}</span>
      <input
        type="text"
        className={`clue-input ${statusClass}`}
        value={value}
        onChange={(e) => {
          // #region agent log
          fetch('http://127.0.0.1:7244/ingest/d2fccf00-3424-45da-b940-77d949e2891b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ClueInput.tsx:60',message:'Input onChange triggered',data:{newValue:e.target.value,number},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          onChange(e.target.value);
        }}
        placeholder="Enter clue..."
        autoComplete="off"
        spellCheck="false"
      />
      <span 
        className={`clue-status ${statusClass}`}
        style={{ 
          // #region agent log
          // Log what's being rendered
          ...(() => {
            const renderedText = `${statusIcon} ${statusClass ? statusClass : ''}`;
            fetch('http://127.0.0.1:7244/ingest/d2fccf00-3424-45da-b940-77d949e2891b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ClueInput.tsx:73',message:'Rendering status text',data:{renderedText,statusIcon,statusClass,hasValue},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            return {};
          })()
          // #endregion
        }}
      >
        {statusIcon} {statusClass ? statusClass : ''}
      </span>
    </div>
  );
};
