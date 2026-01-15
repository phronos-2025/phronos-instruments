import { jsx } from 'react/jsx-runtime';
import { createContext, useState, useEffect, useContext } from 'react';
import { s as supabase } from './Button_DFORBRMv.mjs';

const AuthContext = createContext({
  session: null,
  user: null,
  loading: true
});
function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: session2 } }) => {
      setSession(session2);
      setUser(session2?.user ?? null);
      setLoading(false);
    });
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session2) => {
      setSession(session2);
      setUser(session2?.user ?? null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);
  return /* @__PURE__ */ jsx(AuthContext.Provider, { value: { session, user, loading }, children });
}
function useAuth() {
  return useContext(AuthContext);
}

export { AuthProvider as A, useAuth as u };
