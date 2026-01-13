/**
 * Noise Floor Component
 * 
 * Word cloud with similarity badges on hover
 */

import React, { useEffect } from 'react';
import type { NoiseFloorWord } from '../../lib/api';

interface NoiseFloorProps {
  words: NoiseFloorWord[];
}

export const NoiseFloor: React.FC<NoiseFloorProps> = ({ words }) => {
  // Ensure words is an array and filter out any empty values
  const validWords = Array.isArray(words) ? words.filter(w => w && w.word) : [];
  
  // #region agent log
  useEffect(() => {
    const noiseWordsEl = document.querySelector('.noise-words');
    const firstWordEl = document.querySelector('.noise-word');
    const computedStyle = noiseWordsEl ? window.getComputedStyle(noiseWordsEl) : null;
    const wordStyle = firstWordEl ? window.getComputedStyle(firstWordEl) : null;
    const logData = {
      wordCount: validWords.length,
      hasNoiseWordsEl: !!noiseWordsEl,
      gap: computedStyle?.gap || 'N/A',
      display: computedStyle?.display || 'N/A',
      flexWrap: computedStyle?.flexWrap || 'N/A',
      wordBorder: wordStyle?.border || 'N/A',
      wordPadding: wordStyle?.padding || 'N/A',
      wordDisplay: wordStyle?.display || 'N/A'
    };
    console.log('[DEBUG] NoiseFloor CSS:', logData);
  }, [validWords.length]);
  // #endregion
  
  return (
    <div className="noise-floor">
      <div className="noise-words">
        {validWords.map((item, idx) => (
          <span
            key={`${item.word}-${idx}`}
            className="noise-word"
            data-similarity={item.similarity?.toFixed(2) || '0.00'}
            title={`Similarity: ${item.similarity?.toFixed(2) || '0.00'}`}
          >
            {item.word}
          </span>
        ))}
      </div>
    </div>
  );
};
