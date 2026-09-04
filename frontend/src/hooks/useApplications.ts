import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { STATUS_ORDER, type ApplicationStatus } from '../constants/status';
import {
  DEFAULT_SORT,
  listApplications,
  type Application,
  type ApplicationFilters,
  type ApplicationSort,
} from '../services/applicationsService';
import { queryKeys } from './queryKeys';

export function useApplications(
  filters: ApplicationFilters = {},
  sort: ApplicationSort = DEFAULT_SORT
) {
  const query = useQuery({
    queryKey: queryKeys.applications.list(filters, sort),
    queryFn: () => listApplications(filters, sort),
    staleTime: 30_000,
    placeholderData: keepPreviousData, // keeps the old list on screen while re-sorting
  });

  // Grouping for the Kanban board is derived here, not in the component, so
  // both views consume the same fetch and can never disagree about the data.
  const byStatus = useMemo(() => {
    const groups = Object.fromEntries(STATUS_ORDER.map((s) => [s, [] as Application[]])) as Record<
      ApplicationStatus,
      Application[]
    >;

    for (const app of query.data ?? []) groups[app.status].push(app);
    return groups;
  }, [query.data]);

  return {
    applications: query.data ?? [],
    byStatus,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
