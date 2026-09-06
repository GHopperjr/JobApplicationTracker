import { toAppError } from './errors';
import { supabase } from './supabaseClient';
import type { Database } from '../types/database.types';

export type UserPreferences = Database['public']['Tables']['user_preferences']['Row'];

/**
 * A user who has never set a goal has no row yet — that's a valid state,
 * not an error, and every consumer treats `null` as "no goal set"
 * (docs/12-interview-metrics.md).
 */
export async function getUserPreferences(): Promise<UserPreferences | null> {
  const { data, error } = await supabase.from('user_preferences').select('*').maybeSingle();
  if (error) throw toAppError(error);
  return data;
}

/**
 * Upserts the singleton row rather than requiring the caller to know
 * whether one already exists — `user_id` defaults to `auth.uid()` at the
 * database level, so the conflict target resolves correctly whether this is
 * the first goal ever set or the tenth edit. `null` clears the goal without
 * deleting the row (there is no delete policy on this table by design).
 */
export async function upsertMonthlyGoal(goal: number | null): Promise<UserPreferences> {
  const { data, error } = await supabase
    .from('user_preferences')
    .upsert({ monthly_application_goal: goal }, { onConflict: 'user_id' })
    .select()
    .single();
  if (error) throw toAppError(error);
  return data;
}
