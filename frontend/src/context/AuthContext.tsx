import type { Session } from '@supabase/supabase-js';
import { useEffect, useState, type ReactNode } from 'react';
import * as authService from '../services/authService';
import { supabase } from '../services/supabaseClient';
import { AuthContext, type AuthContextValue } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    authService.getSession().then((s) => {
      setSession(s);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const value: AuthContextValue = {
    user: session?.user ?? null,
    session,
    isLoading,
    signIn: authService.signIn,
    signUp: authService.signUp,
    signOut: authService.signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
