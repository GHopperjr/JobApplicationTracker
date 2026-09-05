import type { Session, User } from '@supabase/supabase-js';
import { createContext } from 'react';

export type AuthContextValue = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  /** True once a session that was present unexpectedly disappears (e.g. the
   * refresh token expired) — as opposed to the user deliberately signing
   * out. `ProtectedRoute` shows the F8 notice and clears this once shown. */
  sessionExpired: boolean;
  clearSessionExpired: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
