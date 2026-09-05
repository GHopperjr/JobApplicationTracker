import { useSearchParams } from 'react-router-dom';
import { PLATFORM_VALUES, type PlatformSource } from '../constants/platforms';
import { STATUS_VALUES, type ApplicationStatus } from '../constants/status';
import type { ApplicationFilters, ApplicationSort, SortField } from '../services/applicationsService';

const SORT_FIELDS: readonly SortField[] = [
  'company_name',
  'job_title',
  'status',
  'platform_source',
  'applied_date',
  'created_at',
];

export function useApplicationFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Validated, not cast: a hand-edited ?status=bogus would otherwise flow
  // into `.in('status', [...])` and return Postgres 22P02.
  const status = searchParams
    .getAll('status')
    .filter((s): s is ApplicationStatus => STATUS_VALUES.includes(s as ApplicationStatus));
  const platform = searchParams
    .getAll('platform')
    .filter((p): p is PlatformSource => PLATFORM_VALUES.includes(p as PlatformSource));

  const filters: ApplicationFilters = {
    status,
    platform,
    search: searchParams.get('q') ?? undefined,
  };

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
    if (next.search !== undefined) {
      if (next.search) params.set('q', next.search);
      else params.delete('q'); // '' and no q must not be two different states
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

  return { filters, sort, view, setFilters, setSort, setView };
}
