/**
 * Share Link Box Component
 * 
 * Copy-to-clipboard input
 */

import React, { useState } from 'react';
import { Button } from './Button';

interface ShareLinkBoxProps {
  url: string;
}

export const ShareLinkBox: React.FC<ShareLinkBoxProps> = ({ url }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };
  
  return (
    <div className="share-link-box">
      <input
        type="text"
        className="share-link-input"
        value={url}
        readOnly
      />
      <button
        className="share-link-btn"
        onClick={handleCopy}
        type="button"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
};
