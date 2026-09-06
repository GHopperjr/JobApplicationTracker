import { useSearchParams } from 'react-router-dom';
import { AUDIENCE_FILTER_VALUES, type AudienceFilterValue } from '../constants/experienceLevel';
import { PLATFORM_VALUES, type PlatformSource } from '../constants/platforms';
import { STATUS_VALUES, type ApplicationStatus } from '../constants/status';
import { computeExperienceLevel } from '../lib/experienceLevel';
import type { ApplicationFilters, ApplicationSort, SortField } from '../services/applicationsService';
import { useUserPreferences } from './useUserPreferences';

const SORT_FIELDS: readonly SortField[] = [
  'company_name',
  'job_title',
  'status',
  'platform_source',
  'applied_date',
  'created_at',
];

const ARCHIVED_VALUES = ['active', 'archived', 'all'] as const;

export function useApplicationFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { graduationDate } = useUserPreferences();

  // Validated, not cast: a hand-edited ?status=bogus would otherwise flow
  // into `.in('status', [...])` and return Postgres 22P02.
  const status = searchParams
    .getAll('status')
    .filter((s): s is ApplicationStatus => STATUS_VALUES.includes(s as ApplicationStatus));
  const platform = searchParams
    .getAll('platform')
    .filter((p): p is PlatformSource => PLATFORM_VALUES.includes(p as PlatformSource));

  const archivedParam = searchParams.get('archived');
  const archived = ARCHIVED_VALUES.includes(archivedParam as (typeof ARCHIVED_VALUES)[number])
    ? (archivedParam as (typeof ARCHIVED_VALUES)[number])
    : 'active';

  // The one filter with a non-empty default: absent means "apply the
  // profile-derived stage plus Not specified" (or show everything, with no
  // graduation date to derive from), not "show everything" the way every
  // other filter treats an absent parameter. `audience=all` is a distinct,
  // explicit sentinel for "the user cleared this on purpose" — without it,
  // zero selected chips and a fresh page load are indistinguishable, and
  // the default would immediately spring back
  // (docs/13-profile-and-experience-filtering.md).
  const audienceParam = searchParams.getAll('audience');
  let audience: AudienceFilterValue[];
  if (audienceParam.length === 0) {
    const derivedStage = computeExperienceLevel(graduationDate);
    audience = derivedStage ? [derivedStage, 'unspecified'] : [];
  } else if (audienceParam.includes('all')) {
    audience = [];
  } else {
    audience = audienceParam.filter((a): a is AudienceFilterValue =>
      AUDIENCE_FILTER_VALUES.includes(a as AudienceFilterValue)
    );
  }

  const filters: ApplicationFilters = {
    status,
    platform,
    search: searchParams.get('q') ?? undefined,
    archived,
    audience,
  };

  // Client-side only (docs/05 F7) — staleness has no server-side predicate,
  // so this is read by the page to filter the already-fetched result set,
  // not passed to listApplications.
  const stale = searchParams.get('stale') === '1';

  const sortFieldParam = searchParams.get('sort');
  const sortDirectionParam = searchParams.get('dir');
  const sort: ApplicationSort = {
    field: SORT_FIELDS.includes(sortFieldParam as SortField)
      ? (sortFieldParam as SortField)
      : 'created_at',
    direction: sortDirectionParam === 'asc' ? 'asc' : 'desc',
  };

  const view: 'kanban' | 'table' = searchParams.get('view') === 'table' ? 'table' : 'kanban';

  const setFilters = (next: Partial<ApplicationFilters>) => {
    const params = new URLSearchParams(searchParams);

    if (next.status !== undefined) {
      params.delete('status');
      next.status.forEach((s) => params.append('status', s));
    }
    if (next.platform !== undefined) {
      params.delete('platform');
      next.platform.forEach((p) => params.append('platform', p));
    }
    if (next.audience !== undefined) {
      params.delete('audience');
      if (next.audience.length === 0) {
        // The explicit "cleared on purpose" sentinel — an empty array here
        // must not become an absent parameter, or the profile-derived
        // default would immediately re-apply.
        params.set('audience', 'all');
      } else {
        next.audience.forEach((a) => params.append('audience', a));
      }
    }
    if (next.search !== undefined) {
      if (next.search) params.set('q', next.search);
      else params.delete('q'); // '' and no q must not be two different states
    }
    if (next.archived !== undefined) {
      // 'active' is the default — omit it rather than writing the common
      // case into every shared URL.
      if (next.archived === 'active') params.delete('archived');
      else params.set('archived', next.archived);
    }

    // Filter changes REPLACE — a search burst must not create a back-button
    // entry per keystroke.
    setSearchParams(params, { replace: true });
  };

  const setSort = (next: ApplicationSort) => {
    const params = new URLSearchParams(searchParams);
    params.set('sort', next.field);
    params.set('dir', next.direction);
    setSearchParams(params, { replace: true });
  };

  const setView = (next: 'kanban' | 'table') => {
    const params = new URLSearchParams(searchParams);
    params.set('view', next);
    setSearchParams(params, { replace: true });
  };

  const setStale = (next: boolean) => {
    const params = new URLSearchParams(searchParams);
    if (next) params.set('stale', '1');
    else params.delete('stale');
    setSearchParams(params, { replace: true });
  };

  return { filters, sort, view, stale, setFilters, setSort, setView, setStale };
}
