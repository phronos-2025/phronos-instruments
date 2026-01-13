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
        {validWords.map((item, idx) => {
          const similarity = item.similarity || 0;
          const similarityPercent = Math.min(Math.max(similarity * 100, 0), 100);
          
          return (
            <span
              key={`${item.word}-${idx}`}
              className="noise-word"
              data-similarity={similarity.toFixed(2)}
              style={{ '--similarity-width': `${similarityPercent}%` } as React.CSSProperties}
              title={`Similarity: ${similarity.toFixed(2)}`}
            >
              {item.word}
            </span>
          );
        })}
      </div>
    </div>
  );
};
