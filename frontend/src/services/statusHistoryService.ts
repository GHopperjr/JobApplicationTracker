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
