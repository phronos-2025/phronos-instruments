/**
 * Participant Provider
 *
 * Mints (or loads) a participant id on mount. Replaces the old Supabase
 * anonymous-auth provider — there are no accounts, emails, or sessions.
 *
 * The component and hook keep the names AuthProvider / useAuth so existing
 * consumers need no changes. useAuth() returns a minimal `user` shape where
 * email is always null and is_anonymous is always true, so every "registered
 * account" branch in the UI now resolves to the unregistered path.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { getParticipant } from '../../lib/participant';

interface ParticipantUser {
  id: string;
  email: null;
  is_anonymous: true;
}

interface AuthContextType {
  participantId: string | null;
  // Compatibility surface for existing consumers:
  user: ParticipantUser | null;
  session: null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  participantId: null,
  user: null,
  session: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getParticipant()
      .then((p) => {
        if (active) setParticipantId(p.participant_id);
      })
      .catch((e) => {
        console.error('Failed to obtain participant:', e);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const user: ParticipantUser | null = participantId
    ? { id: participantId, email: null, is_anonymous: true }
    : null;

  return (
    <AuthContext.Provider value={{ participantId, user, session: null, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

/** New name; prefer this in new code. */
export function useParticipant() {
  const { participantId, loading } = useContext(AuthContext);
  return { participantId, loading };
}

/** Compatibility hook for existing consumers. */
export function useAuth() {
  return useContext(AuthContext);
}

/** Alias so new code can import the provider by its intended name. */
export const ParticipantProvider = AuthProvider;
