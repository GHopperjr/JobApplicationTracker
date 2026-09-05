import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApplicationStatus } from '../constants/status';
import {
  bulkDeleteApplications,
  bulkSetArchived,
  bulkUpdateStatus,
  createApplication,
  deleteApplication,
  updateApplication,
  updateApplicationStatus,
  type Application,
  type ApplicationUpdate,
} from '../services/applicationsService';
import { queryKeys } from './queryKeys';

type MutationCallbacks = {
  onCreated?: () => void;
  onUpdated?: () => void;
  onDeleted?: () => void;
  onStatusError?: () => void;
  onBulkStatusChanged?: (count: number) => void;
  onBulkDeleted?: (count: number) => void;
  onArchived?: (ids: string[], isArchived: boolean) => void;
};

export function useApplicationMutations(callbacks: MutationCallbacks = {}) {
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.applications.all });

  const create = useMutation({
    mutationFn: createApplication,
    onSuccess: () => {
      invalidate();
      callbacks.onCreated?.();
    },
  });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ApplicationUpdate }) =>
      updateApplication(id, patch),
    onSuccess: () => {
      invalidate();
      callbacks.onUpdated?.();
    },
  });

  const remove = useMutation({
    mutationFn: deleteApplication,
    onSuccess: () => {
      invalidate();
      callbacks.onDeleted?.();
    },
  });

  // The hot path: a status change (table's inline select today, a Kanban
  // drag from Phase 3 onward) must feel instant.
  const changeStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ApplicationStatus }) =>
      updateApplicationStatus(id, status),

    onMutate: async ({ id, status }) => {
      // NOTE: `lists`, not `all` — see the query-key warning in queryKeys.ts.
      await queryClient.cancelQueries({ queryKey: queryKeys.applications.lists });
      const previous = queryClient.getQueriesData<Application[]>({
        queryKey: queryKeys.applications.lists,
      });

      queryClient.setQueriesData<Application[]>(
        { queryKey: queryKeys.applications.lists },
        (old) => (Array.isArray(old) ? old.map((a) => (a.id === id ? { ...a, status } : a)) : old)
      );

      return { previous };
    },

    onError: (_err, _vars, context) => {
      // Put every touched cache entry back exactly as it was.
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
      callbacks.onStatusError?.();
    },

    onSettled: invalidate,
  });

  // One request, one rollback — see the bulk-actions note in docs/05 F5.
  // Must not be implemented as N concurrent single-row changeStatus calls.
  const bulkStatus = useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: ApplicationStatus }) =>
      bulkUpdateStatus(ids, status),

    onMutate: async ({ ids, status }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.applications.lists });
      const previous = queryClient.getQueriesData<Application[]>({
        queryKey: queryKeys.applications.lists,
      });

      queryClient.setQueriesData<Application[]>(
        { queryKey: queryKeys.applications.lists },
        (old) => (Array.isArray(old) ? old.map((a) => (ids.includes(a.id) ? { ...a, status } : a)) : old)
      );

      return { previous, count: ids.length };
    },

    onSuccess: (_data, { ids }) => callbacks.onBulkStatusChanged?.(ids.length),

    onError: (_err, _vars, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },

    onSettled: invalidate,
  });

  const bulkRemove = useMutation({
    mutationFn: bulkDeleteApplications,
    onSuccess: (_data, ids) => {
      invalidate();
      callbacks.onBulkDeleted?.(ids.length);
    },
  });

  // One unified mutation for both the single-row menu action and bulk
  // selection — archive is a one-request toggle either way. Optimistically
  // removes the affected rows from every cached list: correct immediately
  // for the common case (archiving while viewing the active list, or
  // restoring while viewing the archive), and self-corrects for the other
  // direction (Undo/restore while viewing the active list) once onSettled's
  // invalidate lands — a brief round-trip on a recovery action, not the hot
  // path this needs to be instant for (docs/05 F9).
  const setArchived = useMutation({
    mutationFn: ({ ids, isArchived }: { ids: string[]; isArchived: boolean }) =>
      bulkSetArchived(ids, isArchived),

    onMutate: async ({ ids }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.applications.lists });
      const previous = queryClient.getQueriesData<Application[]>({
        queryKey: queryKeys.applications.lists,
      });

      queryClient.setQueriesData<Application[]>(
        { queryKey: queryKeys.applications.lists },
        (old) => (Array.isArray(old) ? old.filter((a) => !ids.includes(a.id)) : old)
      );

      return { previous };
    },

    onSuccess: (_data, { ids, isArchived }) => callbacks.onArchived?.(ids, isArchived),

    onError: (_err, _vars, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },

    onSettled: invalidate,
  });

  return { create, update, remove, changeStatus, bulkStatus, bulkRemove, setArchived };
}
