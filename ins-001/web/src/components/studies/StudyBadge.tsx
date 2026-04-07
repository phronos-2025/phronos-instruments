import React from 'react';

type BadgeStatus = 'active' | 'completed' | 'beta';

interface StudyBadgeProps {
  status: BadgeStatus;
}

export function StudyBadge({ status }: StudyBadgeProps) {
  const label = status === 'active' ? 'Active' : status === 'completed' ? 'Completed' : 'Beta';
  const isGreen = status === 'active' || status === 'beta';

  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '9px',
        textTransform: 'uppercase',
        letterSpacing: '1px',
        padding: '4px 8px',
        border: '1px solid',
        color: isGreen ? 'var(--active)' : 'var(--faded)',
        borderColor: isGreen ? 'var(--active)' : 'var(--faded-light)',
      }}
    >
      {label}
    </span>
  );
}
