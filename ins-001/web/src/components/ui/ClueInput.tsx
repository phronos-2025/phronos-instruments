/**
 * Clue Input Component
 * 
 * Input with inline validation status
 */

import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';

interface ClueInputProps {
  number: number;
  value: string;
  onChange: (value: string) => void;
  onValidationChange?: (isValid: boolean) => void;
}

export const ClueInput: React.FC<ClueInputProps> = ({
  number,
  value,
  onChange,
  onValidationChange
}) => {
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  
  useEffect(() => {
    if (!value.trim()) {
      setIsValid(null);
      onValidationChange?.(false);
      return;
    }
    
    // Debounce validation
    const timeoutId = setTimeout(async () => {
      setIsValidating(true);
      try {
        const result = await api.embeddings.validate(value.trim());
        setIsValid(result.valid);
        onValidationChange?.(result.valid);
      } catch (error) {
        setIsValid(false);
        onValidationChange?.(false);
      } finally {
        setIsValidating(false);
      }
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [value, onValidationChange]);
  
  const statusClass = isValid === null ? '' : isValid ? 'valid' : 'invalid';
  const statusText = isValid === null 
    ? '' 
    : isValid 
      ? '✓ valid' 
      : '✗ invalid';
  
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
        {isValidating ? '...' : statusText}
      </span>
    </div>
  );
};
