import type { AudienceFilterValue } from '../constants/experienceLevel';
import { PartialImportError, toAppError } from './errors';
import { geocodeAddress } from './geocodingService';
import { supabase } from './supabaseClient';
import type { Database } from '../types/database.types';

export type Application = Database['public']['Tables']['applications']['Row'];

// `work_setup` and `target_experience_level` are enum columns, so the
// generated Insert/Update types only accept their real values (or
// null/undefined) — not ''. But these functions runtime-normalize '' -> null
// for every OPTIONAL_FIELDS entry below (both included), which is exactly
// what a cleared form Select sends. Widening just these two fields' types
// keeps that contract honest instead of forcing every call site to
// pre-convert '' to null itself.
type EnumFormWidening = {
  work_setup?: Database['public']['Enums']['work_setup'] | '' | null;
  target_experience_level?: Database['public']['Enums']['experience_level'] | '' | null;
};
export type ApplicationInsert = Omit<
  Database['public']['Tables']['applications']['Insert'],
  keyof EnumFormWidening
> &
  EnumFormWidening;
export type ApplicationUpdate = Omit<
  Database['public']['Tables']['applications']['Update'],
  keyof EnumFormWidening
> &
  EnumFormWidening;

export type ApplicationFilters = {
  status?: Application['status'][];
  platform?: Application['platform_source'][];
  search?: string;
  /** 'active' (default) | 'archived' | 'all'. Archived rows are excluded unless asked for. */
  archived?: 'active' | 'archived' | 'all';
  /** Empty means "no audience filter" (show everything) — the empty-array
   * "show all" convention every other filter here already uses. The
   * caller-facing "explicitly cleared" sentinel lives in the URL layer
   * (useApplicationFilters), not here. */
  audience?: AudienceFilterValue[];
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

  if (filters.audience?.length) {
    const realValues = filters.audience.filter((a) => a !== 'unspecified');
    const includesUnspecified = filters.audience.includes('unspecified');

    if (realValues.length && includesUnspecified) {
      // .in(…) and .is(…, null) chained together AND — producing zero rows
      // every time, since a row can't match both. One .or() selects both at
      // once (docs/13-profile-and-experience-filtering.md). Safe to
      // interpolate unescaped: these values are drawn from a fixed constant
      // list, never user input, unlike the search branch below.
      query = query.or(
        `target_experience_level.in.(${realValues.join(',')}),target_experience_level.is.null`
      );
    } else if (realValues.length) {
      query = query.in('target_experience_level', realValues);
    } else if (includesUnspecified) {
      query = query.is('target_experience_level', null);
    }
  }

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
  'target_experience_level',
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

// Whenever an application's own coordinates change, any cached road
// distance was computed against the old destination and is now wrong — not
// just stale-by-location-id, since the badge's staleness check compares
// coordinates, not ids. Every write path that changes location_latitude/
// location_longitude clears these in the same statement so the cache can
// never point at a destination that no longer applies
// (docs/11-navigation-and-distance.md).
const CLEARED_ROAD_DISTANCE = {
  road_distance_meters: null,
  road_duration_seconds: null,
  road_distance_from_lat: null,
  road_distance_from_lng: null,
} as const;

// Fire-and-forget, unlike savedLocationsService's awaited geocode — this is
// the hot path (every application add/edit), and Realtime is already
// subscribed to this table (useRealtimeApplications), so the coordinate
// patch below reaches the UI as soon as it resolves without this function's
// own promise ever waiting on it. A failed geocode leaves the columns null,
// never an error (docs/11-navigation-and-distance.md).
async function geocodeAndPatchLocation(id: string, location: string): Promise<void> {
  // Swallows everything: nothing downstream of a fire-and-forget call has
  // anywhere to report an error to, and an unhandled rejection here (an
  // offline patch, say) would surface as noise for a purely optional
  // enhancement.
  try {
    const coords = await geocodeAddress(location);
    if (!coords) return;
    await supabase
      .from('applications')
      .update({
        location_latitude: coords.latitude,
        location_longitude: coords.longitude,
        ...CLEARED_ROAD_DISTANCE,
      })
      .eq('id', id);
  } catch {
    // A row without coordinates is a valid row — see the null branch every
    // distance consumer already has.
  }
}

async function clearLocationCoordinates(id: string): Promise<void> {
  try {
    await supabase
      .from('applications')
      .update({ location_latitude: null, location_longitude: null, ...CLEARED_ROAD_DISTANCE })
      .eq('id', id);
  } catch {
    // Same contract as above: best-effort cleanup, never an error path.
  }
}

/**
 * Persists the road distance badge's one-time-per-change cache
 * (docs/11-navigation-and-distance.md). Fire-and-forget from the caller,
 * same contract as geocodeAndPatchLocation — Realtime carries the patch back
 * to whichever card requested it, and a failed write just means the badge
 * tries again on the next render.
 */
export async function updateApplicationRoadDistance(
  id: string,
  cache: {
    roadDistanceMeters: number;
    roadDurationSeconds: number;
    roadDistanceFromLat: number;
    roadDistanceFromLng: number;
  }
): Promise<void> {
  try {
    await supabase
      .from('applications')
      .update({
        road_distance_meters: cache.roadDistanceMeters,
        road_duration_seconds: cache.roadDurationSeconds,
        road_distance_from_lat: cache.roadDistanceFromLat,
        road_distance_from_lng: cache.roadDistanceFromLng,
      })
      .eq('id', id);
  } catch {
    // Best-effort: the next render that finds the cache still stale simply
    // tries again.
  }
}

export async function createApplication(input: ApplicationInsert): Promise<Application> {
  const { data, error } = await supabase
    .from('applications')
    .insert(normalizeOptionalFields(input) as Database['public']['Tables']['applications']['Insert'])
    .select()
    .single();

  if (error) throw toAppError(error);

  // Only geocode in the background when the caller didn't already supply
  // resolved coordinates (e.g. from the address-autocomplete picker) — those
  // are already part of the row just inserted, and re-geocoding would waste
  // a request and risks a slightly different match overwriting a confirmed one.
  const hasCoords = input.location_latitude != null && input.location_longitude != null;
  if (data.location && !hasCoords) void geocodeAndPatchLocation(data.id, data.location);
  return data;
}

export async function updateApplication(
  id: string,
  patch: ApplicationUpdate
): Promise<Application> {
  const normalized = normalizeOptionalFields(patch);
  // A patch that sets location_latitude/longitude directly (the
  // address-picker path) changes the destination in this same statement, so
  // the road distance cache must be invalidated here too — the background
  // geocode path below has its own copy of this because it's a separate
  // statement, not because the rule differs.
  if ('location_latitude' in patch || 'location_longitude' in patch) {
    Object.assign(normalized, CLEARED_ROAD_DISTANCE);
  }

  const { data, error } = await supabase
    .from('applications')
    .update(normalized as Database['public']['Tables']['applications']['Update'])
    .eq('id', id)
    .select()
    .single();

  if (error) throw toAppError(error);

  // Only re-geocode when `location` was actually part of this patch — an
  // edit to notes/salary/etc. shouldn't cost a network call — and only when
  // the caller didn't already supply resolved coordinates alongside it (see
  // createApplication's comment above; same reasoning applies here).
  const hasCoords = patch.location_latitude != null && patch.location_longitude != null;
  if ('location' in patch && !hasCoords) {
    if (patch.location && patch.location.trim()) {
      void geocodeAndPatchLocation(id, patch.location);
    } else {
      void clearLocationCoordinates(id);
    }
  }

  return data;
}

export async function updateApplicationStatus(
  id: string,
  status: Application['status'],
  // `undefined` (the default) means "don't touch this column" — distinct
  // from `null`, which explicitly clears a previously-recorded date. Lets
  // the status-change guard's "skip the interview prompt" path leave an
  // existing date alone rather than always overwriting it (docs/05).
  interviewScheduledAt?: string | null
): Promise<Application> {
  // Dedicated function rather than a generic update: this is the single most
  // frequent write in the app (every Kanban drag / table status change), it
  // is the one write with a database-side side effect (the status_history
  // trigger), and giving it its own name makes the optimistic-update path in
  // useApplicationMutations explicit.
  const patch: ApplicationUpdate = { status };
  if (interviewScheduledAt !== undefined) patch.interview_scheduled_at = interviewScheduledAt;
  return updateApplication(id, patch);
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
  status: Application['status'],
  interviewScheduledAt?: string | null
): Promise<Application[]> {
  const patch: Database['public']['Tables']['applications']['Update'] = { status };
  if (interviewScheduledAt !== undefined) patch.interview_scheduled_at = interviewScheduledAt;

  const { data, error } = await supabase
    .from('applications')
    .update(patch)
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
/**
 * Chunked, sequential inserts for CSV import (docs/10-data-import-export.md).
 * Sequential rather than parallel: on failure, "the first N committed" must
 * be a statement bulkCreate can make truthfully, which a parallel chunk race
 * would not allow.
 *
 * Deliberately does not geocode imported rows' `location` — Nominatim's
 * usage policy explicitly forbids bulk geocoding, and an import can be
 * hundreds of rows from one user action (docs/11-navigation-and-distance.md).
 * Imported applications simply have no distance until their location is
 * edited by hand through the normal update path.
 */
export async function bulkCreate(
  rows: ApplicationInsert[],
  onProgress?: (imported: number, total: number) => void
): Promise<Application[]> {
  const CHUNK = 100;
  const created: Application[] = [];

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK).map(normalizeOptionalFields);
    const { data, error } = await supabase
      .from('applications')
      .insert(chunk as Database['public']['Tables']['applications']['Insert'][])
      .select();

    if (error) throw new PartialImportError(toAppError(error), created.length, rows.length);
    created.push(...(data ?? []));
    onProgress?.(created.length, rows.length);
  }

  return created;
}

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
