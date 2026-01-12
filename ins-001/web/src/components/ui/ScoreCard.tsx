/**
 * Score Card Component
 * 
 * Metric display with bar visualization
 */

import React from 'react';

interface ScoreCardProps {
  label: string;
  value: number;
  interpretation?: string;
}

export const ScoreCard: React.FC<ScoreCardProps> = ({
  label,
  value,
  interpretation
}) => {
  const percentage = Math.round(value * 100);
  
  return (
    <div className="score-card">
      <div className="score-label">{label}</div>
      <div className="score-value">{value.toFixed(2)}</div>
      {interpretation && (
        <div className="score-interpretation">{interpretation}</div>
      )}
      <div className="score-bar">
        <div className="score-bar-fill" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
};
