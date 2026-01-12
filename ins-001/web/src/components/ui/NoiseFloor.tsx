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
  return (
    <div className="noise-floor">
      <div className="noise-words">
        {words.map((item, idx) => (
          <span
            key={idx}
            className="noise-word"
            data-similarity={item.similarity.toFixed(2)}
            title={`Similarity: ${item.similarity.toFixed(2)}`}
          >
            {item.word}
          </span>
        ))}
      </div>
    </div>
  );
};
