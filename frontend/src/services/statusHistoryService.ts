import { toAppError } from './errors';
import { supabase } from './supabaseClient';
import type { Database } from '../types/database.types';

export type StatusHistory = Database['public']['Tables']['status_history']['Row'];

export async function listForApplication(applicationId: string): Promise<StatusHistory[]> {
  const { data, error } = await supabase
    .from('status_history')
    .select('*')
    .eq('application_id', applicationId)
    .order('changed_at', { ascending: false });

  if (error) throw toAppError(error);
  return data ?? [];
}

/**
 * Every history row for the current user, no application filter — this is
 * what makes the metrics funnel "reached interview stage" check possible
 * without one query per application. RLS alone scopes it to the caller,
 * the same reliance `listApplications` already has.
 *
 * Unlike every other list function in this file, a failure here returns
 * `[]` rather than throwing: this feeds an auxiliary insights page, not a
 * write path, and a `reachedInterviewStage` check simply reads as "never
 * reached" against an empty history rather than taking the whole metrics
 * page down over a transient read failure (docs/12-interview-metrics.md).
 */
export async function listStatusHistory(): Promise<StatusHistory[]> {
  try {
    const { data, error } = await supabase.from('status_history').select('*');
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}
