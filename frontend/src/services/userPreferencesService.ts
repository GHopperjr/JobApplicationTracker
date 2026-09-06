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
 * the first preference ever set or the tenth edit. `null` on either field
 * clears it without deleting the row (there is no delete policy on this
 * table by design).
 *
 * One function for every column on this table rather than one per
 * preference (`upsertMonthlyGoal`, `upsertGraduationDate`, …) — they're all
 * the same upsert against the same row, and a second preference
 * (docs/13-profile-and-experience-filtering.md's graduation date, after
 * docs/12's monthly goal) is exactly the case that would otherwise start
 * duplicating this.
 */
export async function upsertUserPreferences(
  patch: Partial<Pick<UserPreferences, 'monthly_application_goal' | 'graduation_date'>>
): Promise<UserPreferences> {
  const { data, error } = await supabase
    .from('user_preferences')
    .upsert(patch, { onConflict: 'user_id' })
    .select()
    .single();
  if (error) throw toAppError(error);
  return data;
}
