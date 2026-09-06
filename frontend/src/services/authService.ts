import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { toAuthError } from './errors';
import { supabase } from './supabaseClient';

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw toAuthError(error);
}

export async function signUp(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${window.location.origin}/login` },
  });
  if (error) throw toAuthError(error);
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw toAuthError(error);
}

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/**
 * The live session subscription — kept here rather than called directly
 * from AuthContext so every Supabase call in the app stays confined to
 * services/*.ts, this module included.
 */
export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void
): { unsubscribe: () => void } {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange(callback);
  return subscription;
}
