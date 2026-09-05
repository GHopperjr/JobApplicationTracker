import type { ApplicationFilters, ApplicationSort } from '../services/applicationsService';

export const queryKeys = {
  applications: {
    all: ['applications'] as const,
    // `lists` is the prefix that matches EVERY list query regardless of
    // filters/sort. Optimistic updates target this, never `all` — an
    // optimistic updater written against `all` also prefix-matches
    // `detail(id)` (a single object, not an array) and throws inside
    // onMutate before the mutation ever fires.
    lists: ['applications', 'list'] as const,
    list: (filters: ApplicationFilters, sort: ApplicationSort) =>
      ['applications', 'list', filters, sort] as const,
    detail: (id: string) => ['applications', 'detail', id] as const,
    history: (id: string) => ['applications', 'history', id] as const,
  },
  savedLocations: {
    all: ['saved-locations'] as const,
  },
};
