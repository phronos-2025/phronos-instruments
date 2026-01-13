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
    const computedStyle = noiseWordsEl ? window.getComputedStyle(noiseWordsEl) : null;
    fetch('http://127.0.0.1:7244/ingest/d2fccf00-3424-45da-b940-77d949e2891b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'NoiseFloor.tsx:18',message:'NoiseFloor rendered',data:{wordCount:validWords.length,hasNoiseWordsEl:!!noiseWordsEl,gap:computedStyle?.gap||'N/A',display:computedStyle?.display||'N/A',flexWrap:computedStyle?.flexWrap||'N/A'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
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
