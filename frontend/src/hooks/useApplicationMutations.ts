import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { ApplicationStatus } from '../constants/status';
import {
  bulkCreate,
  bulkDeleteApplications,
  bulkSetArchived,
  bulkUpdateStatus,
  createApplication,
  deleteApplication,
  updateApplication,
  updateApplicationStatus,
  type Application,
  type ApplicationInsert,
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
  onImported?: (count: number) => void;
};

type OptimisticListContext = {
  previous: [readonly unknown[], Application[] | undefined][];
};

// `changeStatus`, `bulkStatus`, and `setArchived` all optimistically rewrite
// every cached list the same way — cancel in-flight fetches, snapshot every
// list query, then apply `updater` to each. Centralized so the cancel /
// snapshot / write sequence (and its rollback below) can't drift between the
// three call sites (docs/03-frontend-architecture.md's optimistic-update
// pattern).
async function optimisticListUpdate(
  queryClient: QueryClient,
  updater: (applications: Application[]) => Application[]
): Promise<OptimisticListContext> {
  await queryClient.cancelQueries({ queryKey: queryKeys.applications.lists });
  const previous = queryClient.getQueriesData<Application[]>({
    queryKey: queryKeys.applications.lists,
  });

  queryClient.setQueriesData<Application[]>({ queryKey: queryKeys.applications.lists }, (old) =>
    Array.isArray(old) ? updater(old) : old
  );

  return { previous };
}

function rollbackListUpdate(queryClient: QueryClient, context: OptimisticListContext | undefined) {
  context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
}

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

    // NOTE: `lists`, not `all` — see the query-key warning in queryKeys.ts.
    onMutate: ({ id, status }) =>
      optimisticListUpdate(queryClient, (apps) =>
        apps.map((a) => (a.id === id ? { ...a, status } : a))
      ),

    onError: (_err, _vars, context) => {
      rollbackListUpdate(queryClient, context);
      callbacks.onStatusError?.();
    },

    onSettled: invalidate,
  });

  // One request, one rollback — see the bulk-actions note in docs/05 F5.
  // Must not be implemented as N concurrent single-row changeStatus calls.
  const bulkStatus = useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: ApplicationStatus }) =>
      bulkUpdateStatus(ids, status),

    onMutate: ({ ids, status }) =>
      optimisticListUpdate(queryClient, (apps) =>
        apps.map((a) => (ids.includes(a.id) ? { ...a, status } : a))
      ),

    onSuccess: (_data, { ids }) => callbacks.onBulkStatusChanged?.(ids.length),

    onError: (_err, _vars, context) => rollbackListUpdate(queryClient, context),

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

    onMutate: ({ ids }) =>
      optimisticListUpdate(queryClient, (apps) => apps.filter((a) => !ids.includes(a.id))),

    onSuccess: (_data, { ids, isArchived }) => callbacks.onArchived?.(ids, isArchived),

    onError: (_err, _vars, context) => rollbackListUpdate(queryClient, context),

    onSettled: invalidate,
  });

  // No optimistic update: import is additive, not a change to existing rows,
  // and its own progress bar (docs/10-data-import-export.md Step 4) is the
  // feedback while it runs. `PartialImportError` still means some chunks
  // committed, so the cache is invalidated on error too, not just success —
  // ImportModal reads the thrown error itself for the "imported N of M" UI.
  const importMany = useMutation({
    mutationFn: ({
      rows,
      onProgress,
    }: {
      rows: ApplicationInsert[];
      onProgress?: (imported: number, total: number) => void;
    }) => bulkCreate(rows, onProgress),

    onSuccess: (data) => {
      invalidate();
      callbacks.onImported?.(data.length);
    },

    onError: invalidate,
  });

  return { create, update, remove, changeStatus, bulkStatus, bulkRemove, setArchived, importMany };
}
