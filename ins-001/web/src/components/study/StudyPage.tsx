/**
 * StudyPage — Wrapper component for Astro client:load hydration.
 * Wraps StudyFlow with AuthProvider.
 */

import React from 'react';
import { AuthProvider } from '../auth/AuthProvider';
import { StudyFlow } from './StudyFlow';

interface Props {
  slug: string;
}

export function StudyPage({ slug }: Props) {
  return (
    <AuthProvider>
      <StudyFlow slug={slug} />
    </AuthProvider>
  );
}
