import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import * as authService from '../services/authService';
import { supabase } from '../services/supabaseClient';
import { AuthContext, type AuthContextValue } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  // Supabase fires the same `SIGNED_OUT` event both for a deliberate sign-out
  // and for a refresh-token failure — this ref is how the handler below
  // tells the two apart without either state going through the other.
  const sessionRef = useRef<Session | null>(null);
  const manualSignOutRef = useRef(false);

  useEffect(() => {
    authService.getSession().then((s) => {
      sessionRef.current = s;
      setSession(s);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'SIGNED_OUT' && sessionRef.current && !manualSignOutRef.current) {
        setSessionExpired(true);
      }
      sessionRef.current = newSession;
      setSession(newSession);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    manualSignOutRef.current = true;
    try {
      await authService.signOut();
    } finally {
      manualSignOutRef.current = false;
    }
  }, []);

  const clearSessionExpired = useCallback(() => setSessionExpired(false), []);

  const value: AuthContextValue = {
    user: session?.user ?? null,
    session,
    isLoading,
    sessionExpired,
    clearSessionExpired,
    signIn: authService.signIn,
    signUp: authService.signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
