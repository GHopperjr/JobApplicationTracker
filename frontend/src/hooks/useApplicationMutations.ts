import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApplicationStatus } from '../constants/status';
import {
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

  return { create, update, remove, changeStatus };
}
