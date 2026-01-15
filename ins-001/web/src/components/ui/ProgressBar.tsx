/**
 * Progress Bar Component
 *
 * 3-step indicator for game flow
 */

import React from 'react';

interface ProgressBarProps {
  currentStep: number;
  totalSteps?: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  currentStep,
  totalSteps = 3
}) => {
  return (
    <div className="progress">
      {Array.from({ length: totalSteps }, (_, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === currentStep;
        const isCompleted = stepNum < currentStep;
        
        return (
          <div
            key={i}
            className={`progress-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
          />
        );
      })}
    </div>
  );
};
