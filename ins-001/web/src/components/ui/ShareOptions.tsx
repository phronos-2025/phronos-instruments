/**
 * Share Options Component
 * 
 * Two-option grid for choosing Claude AI or Send to Friend
 */

import React from 'react';

interface ShareOptionProps {
  icon: string;
  title: string;
  description: string;
  onClick: () => void;
}

const ShareOption: React.FC<ShareOptionProps> = ({ icon, title, description, onClick }) => {
  return (
    <div className="share-option" onClick={onClick}>
      <div className="share-option-icon">{icon}</div>
      <div className="share-option-title">{title}</div>
      <div className="share-option-desc">{description}</div>
    </div>
  );
};

interface ShareOptionsProps {
  onClaudeClick: () => void;
  onFriendClick: () => void;
}

export const ShareOptions: React.FC<ShareOptionsProps> = ({
  onClaudeClick,
  onFriendClick
}) => {
  return (
    <div className="share-options">
      <ShareOption
        icon="🤖"
        title="Claude (AI)"
        description="Instant results. Measure how well an LLM decodes your associations."
        onClick={onClaudeClick}
      />
      <ShareOption
        icon="🔗"
        title="Send to a Friend"
        description="Generate a link. Measure network convergence with someone you know."
        onClick={onFriendClick}
      />
    </div>
  );
};
