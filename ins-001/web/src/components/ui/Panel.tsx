/**
 * Panel Component
 * 
 * Card with header, grid background, gold border on focus
 */

import React from 'react';

interface PanelProps {
  title?: string;
  meta?: string;
  children: React.ReactNode;
  className?: string;
}

export const Panel: React.FC<PanelProps> = ({ title, meta, children, className = '' }) => {
  return (
    <div className={`panel ${className}`}>
      {(title || meta) && (
        <div className="panel-header">
          {title && <span className="panel-title">{title}</span>}
          {meta && <span className="panel-meta">{meta}</span>}
        </div>
      )}
      <div className="panel-content">{children}</div>
    </div>
  );
};
