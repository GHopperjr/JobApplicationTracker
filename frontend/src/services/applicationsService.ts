import { toAppError } from './errors';
import { supabase } from './supabaseClient';
import type { Database } from '../types/database.types';

export type Application = Database['public']['Tables']['applications']['Row'];

// `work_setup` is an enum column, so the generated Insert/Update types only
// accept its real values (or null/undefined) — not ''. But these functions
// runtime-normalize '' -> null for every OPTIONAL_FIELDS entry below
// (including work_setup), which is exactly what a cleared form Select sends.
// Widening just this one field's type keeps that contract honest instead of
// forcing every call site to pre-convert '' to null itself.
export type ApplicationInsert = Omit<
  Database['public']['Tables']['applications']['Insert'],
  'work_setup'
> & { work_setup?: Database['public']['Enums']['work_setup'] | '' | null };
export type ApplicationUpdate = Omit<
  Database['public']['Tables']['applications']['Update'],
  'work_setup'
> & { work_setup?: Database['public']['Enums']['work_setup'] | '' | null };

export type ApplicationFilters = {
  status?: Application['status'][];
  platform?: Application['platform_source'][];
  search?: string;
  /** 'active' (default) | 'archived' | 'all'. Archived rows are excluded unless asked for. */
  archived?: 'active' | 'archived' | 'all';
};

export type SortField =
  | 'company_name'
  | 'job_title'
  | 'status'
  | 'platform_source'
  | 'applied_date'
  | 'created_at';

export type ApplicationSort = {
  field: SortField;
  direction: 'asc' | 'desc';
};

export const DEFAULT_SORT: ApplicationSort = { field: 'created_at', direction: 'desc' };

/**
 * PostgREST's `or=` takes a RAW filter string — supabase-js does no escaping
 * of it. An unescaped comma, parenthesis, or quote in user input breaks the
 * parse (HTTP 400) or injects extra conditions. Wrapping the value in double
 * quotes and escaping embedded quotes/backslashes is mandatory, not optional.
 */
function escapeOrFilterValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export async function listApplications(
  filters: ApplicationFilters = {},
  sort: ApplicationSort = DEFAULT_SORT
): Promise<Application[]> {
  let query = supabase.from('applications').select('*');

  // Archived rows are excluded by default. Every list surface in the app
  // reads through here, so the exclusion cannot be forgotten by a caller.
  const archived = filters.archived ?? 'active';
  if (archived === 'active') query = query.eq('is_archived', false);
  else if (archived === 'archived') query = query.eq('is_archived', true);

  if (filters.status?.length) query = query.in('status', filters.status);
  if (filters.platform?.length) query = query.in('platform_source', filters.platform);

  if (filters.search) {
    const term = escapeOrFilterValue(`%${filters.search}%`);
    query = query.or(`company_name.ilike.${term},job_title.ilike.${term}`);
  }

  // Postgres enums sort by DECLARATION order, and application_status is
  // declared in pipeline order, so a plain column sort already yields
  // Pending -> Scheduled -> Interviewed -> Rejected -> Accepted.
  query = query.order(sort.field, {
    ascending: sort.direction === 'asc',
    nullsFirst: false, // applied_date is nullable; keep undated rows last either way
  });

  // Stable tiebreak so equal sort values don't reorder between fetches.
  if (sort.field !== 'created_at') {
    query = query.order('created_at', { ascending: false });
  }

  // PostgREST caps rows server-side (default 1000). Be explicit rather than
  // silently truncating at scale.
  query = query.limit(500);

  const { data, error } = await query;
  if (error) throw toAppError(error);
  return data ?? [];
}

/**
 * Coerce '' -> null on every optional field before it reaches Postgres.
 * Without this, saving an application with no job link violates the check
 * constraint and fails outright (docs/01-database-schema.md).
 */
const OPTIONAL_FIELDS = [
  'job_link',
  'salary_range',
  'location',
  'applied_date',
  'notes',
  'work_setup',
] as const;

// The return type is the strict Supabase-generated shape, not <T>: this is
// where the widened '' the form sends for enum fields like work_setup
// actually becomes the null the database (and Supabase's own types) expect.
function normalizeOptionalFields<T extends Record<string, unknown>>(
  input: T
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...input };
  for (const field of OPTIONAL_FIELDS) {
    if (field in out && typeof out[field] === 'string' && out[field].trim() === '') {
      out[field] = null;
    }
  }
  return out;
}

export async function createApplication(input: ApplicationInsert): Promise<Application> {
  const { data, error } = await supabase
    .from('applications')
    .insert(normalizeOptionalFields(input) as Database['public']['Tables']['applications']['Insert'])
    .select()
    .single();

  if (error) throw toAppError(error);
  return data;
}

export async function updateApplication(
  id: string,
  patch: ApplicationUpdate
): Promise<Application> {
  const { data, error } = await supabase
    .from('applications')
    .update(normalizeOptionalFields(patch) as Database['public']['Tables']['applications']['Update'])
    .eq('id', id)
    .select()
    .single();

  if (error) throw toAppError(error);
  return data;
}

export async function updateApplicationStatus(
  id: string,
  status: Application['status']
): Promise<Application> {
  // Dedicated function rather than a generic update: this is the single most
  // frequent write in the app (every Kanban drag / table status change), it
  // is the one write with a database-side side effect (the status_history
  // trigger), and giving it its own name makes the optimistic-update path in
  // useApplicationMutations explicit.
  return updateApplication(id, { status });
}

export async function deleteApplication(id: string): Promise<void> {
  const { error } = await supabase.from('applications').delete().eq('id', id);
  if (error) throw toAppError(error);
}

/**
 * ONE request, not N. Running N concurrent single-row changeStatus
 * mutations corrupts rollback (each snapshots a cache already containing
 * the others' writes), so bulk deliberately doesn't reuse
 * updateApplicationStatus per row (docs/02-backend-architecture.md).
 */
export async function bulkUpdateStatus(
  ids: string[],
  status: Application['status']
): Promise<Application[]> {
  const { data, error } = await supabase
    .from('applications')
    .update({ status })
    .in('id', ids)
    .select();

  if (error) throw toAppError(error);
  return data ?? [];
}

export async function bulkDeleteApplications(ids: string[]): Promise<void> {
  const { error } = await supabase.from('applications').delete().in('id', ids);
  if (error) throw toAppError(error);
}

/**
 * Archive is orthogonal to status (docs/01-database-schema.md) — a single
 * request either way, so one function serves the single-row menu action and
 * the bulk-selection action alike (mirroring bulkUpdateStatus's shape).
 */
export async function bulkSetArchived(ids: string[], isArchived: boolean): Promise<Application[]> {
  const { data, error } = await supabase
    .from('applications')
    .update({ is_archived: isArchived })
    .in('id', ids)
    .select();

  if (error) throw toAppError(error);
  return data ?? [];
}

/**
 * Case-insensitive match on company + job title, including archived rows —
 * "you already applied and archived it" is exactly the case worth surfacing
 * (docs/05-features-and-workflows.md F2). `excludeId` omits the record being
 * edited, or every save would flag itself as its own duplicate.
 */
export async function findPotentialDuplicates(
  companyName: string,
  jobTitle: string,
  excludeId?: string
): Promise<Application[]> {
  let query = supabase
    .from('applications')
    .select('*')
    .ilike('company_name', companyName.trim())
    .ilike('job_title', jobTitle.trim());

  if (excludeId) query = query.neq('id', excludeId);

  const { data, error } = await query;
  if (error) throw toAppError(error);
  return data ?? [];
}
