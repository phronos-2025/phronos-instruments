/**
 * Noise Floor Component
 * 
 * Word cloud with similarity badges on hover
 */

import React from 'react';
import type { NoiseFloorWord } from '../../lib/api';

interface NoiseFloorProps {
  words: NoiseFloorWord[];
}

export const NoiseFloor: React.FC<NoiseFloorProps> = ({ words }) => {
  // Ensure words is an array and filter out any empty values
  const validWords = Array.isArray(words) ? words.filter(w => w && w.word) : [];
  
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
