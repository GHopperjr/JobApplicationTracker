import { useCallback, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ApplicationDetailDrawer } from '../components/application/ApplicationDetailDrawer';
import { ApplicationFormModal } from '../components/application/ApplicationFormModal';
import { FilterBar } from '../components/filters/FilterBar';
import { KanbanBoard } from '../components/kanban/KanbanBoard';
import { ApplicationsTable } from '../components/table/ApplicationsTable';
import { TableToolbar } from '../components/table/TableToolbar';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { ROUTES } from '../constants/routes';
import type { ApplicationStatus } from '../constants/status';
import { useApplicationFilters } from '../hooks/useApplicationFilters';
import { useApplicationForm } from '../hooks/useApplicationForm';
import { useApplicationMutations } from '../hooks/useApplicationMutations';
import { useApplications } from '../hooks/useApplications';
import { useToast } from '../hooks/useToast';
import { DEFAULT_SORT, type Application } from '../services/applicationsService';

export function ApplicationsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { filters, sort, view, setFilters, setSort } = useApplicationFilters();

  // Kanban always uses DEFAULT_SORT and never varies it — only the Table
  // view exposes sort controls (docs/03-frontend-architecture.md). With the
  // table at its default sort, both views hit the identical query key, so
  // toggling between them triggers no refetch.
  const { applications, byStatus, isLoading } = useApplications(
    filters,
    view === 'table' ? sort : DEFAULT_SORT
  );
  const { formState, openEdit, close } = useApplicationForm();
  const { show } = useToast();

  // The page owns mutations and the delete-confirmation dialog — Card,
  // TableRow, and the Detail Drawer all receive onEdit/onDelete/
  // onStatusChange as props rather than calling these hooks themselves
  // (docs/03 and docs/07's composition contract).
  const mutations = useApplicationMutations({
    onDeleted: () => show('Application deleted.'),
    onStatusError: () => show("Couldn't update status. Please try again.", 'error'),
    onBulkStatusChanged: (count) => show(`Status updated for ${count} applications.`),
    onBulkDeleted: (count) => show(`${count} applications deleted.`),
  });
  const [pendingDelete, setPendingDelete] = useState<Application | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const openDetail = useCallback(
    (appId: string) => navigate({ pathname: ROUTES.application(appId), search: location.search }),
    [navigate, location.search]
  );
  const closeDetail = useCallback(
    () => navigate({ pathname: ROUTES.applications, search: location.search }),
    [navigate, location.search]
  );
  const confirmDelete = useCallback((application: Application) => setPendingDelete(application), []);
  // `mutations.changeStatus` (the object) is a fresh reference every render
  // — useMutation() returns `{...result, mutate}` via spread — but `.mutate`
  // itself is wrapped in its own internal useCallback keyed on a stable
  // observer, so it genuinely doesn't change (verified directly against
  // @tanstack/react-query's source, not assumed). Depending on the whole
  // object, as exhaustive-deps suggests, would recreate this callback every
  // render and defeat the memoization ApplicationCard relies on it for.
  const onStatusChange = useCallback(
    (appId: string, status: ApplicationStatus) => mutations.changeStatus.mutate({ id: appId, status }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mutations.changeStatus.mutate]
  );

  const handleConfirmDelete = () => {
    if (!pendingDelete) return;
    mutations.remove.mutate(pendingDelete.id);
    if (pendingDelete.id === id) closeDetail();
    setPendingDelete(null);
  };

  const toggleSelect = useCallback((appId: string) => {
    setSelectedIds((prev) =>
      prev.includes(appId) ? prev.filter((i) => i !== appId) : [...prev, appId]
    );
  }, []);
  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => (prev.length === applications.length ? [] : applications.map((a) => a.id)));
  }, [applications]);
  const clearSelection = useCallback(() => setSelectedIds([]), []);

  const handleBulkStatusChange = (status: ApplicationStatus) => {
    mutations.bulkStatus.mutate({ ids: selectedIds, status });
    setSelectedIds([]);
  };
  const handleConfirmBulkDelete = () => {
    mutations.bulkRemove.mutate(selectedIds);
    setSelectedIds([]);
    setBulkDeleteOpen(false);
  };

  const detailApplication = id ? applications.find((a) => a.id === id) : undefined;

  return (
    <div className="pb-8">
      <FilterBar filters={filters} onChange={setFilters} />

      {view === 'kanban' ? (
        <KanbanBoard
          byStatus={byStatus}
          isLoading={isLoading}
          onCardClick={openDetail}
          onEdit={openEdit}
          onDelete={confirmDelete}
          onStatusChange={onStatusChange}
          statusFilter={filters.status}
        />
      ) : (
        <>
          <TableToolbar
            count={applications.length}
            selectedCount={selectedIds.length}
            onBulkStatusChange={handleBulkStatusChange}
            onBulkDelete={() => setBulkDeleteOpen(true)}
            onClearSelection={clearSelection}
          />
          <div className="px-6 pt-3">
            <ApplicationsTable
              applications={applications}
              isLoading={isLoading}
              sort={sort}
              onSortChange={setSort}
              onRowClick={openDetail}
              onEdit={openEdit}
              onDelete={confirmDelete}
              onStatusChange={onStatusChange}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={toggleSelectAll}
            />
          </div>
        </>
      )}

      <ApplicationFormModal
        isOpen={formState.mode !== 'closed'}
        application={formState.mode === 'edit' ? formState.application : undefined}
        onClose={close}
      />

      {/* Always rendered (never conditionally mounted): AnimatePresence
          inside Drawer can only play a close animation if it sees `isOpen`
          go false while staying mounted — a parent-level {id && ...} yanks
          the whole subtree out instantly, before AnimatePresence ever gets
          a chance to intercept the removal. Same pattern as
          ApplicationFormModal above. */}
      <ApplicationDetailDrawer
        isOpen={Boolean(id)}
        application={detailApplication}
        isLoading={isLoading}
        onClose={closeDetail}
        onEdit={openEdit}
        onDelete={confirmDelete}
      />

      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        title="Delete application"
        message={
          pendingDelete
            ? `Delete the application for ${pendingDelete.job_title} at ${pendingDelete.company_name}? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <ConfirmDialog
        isOpen={bulkDeleteOpen}
        title="Delete applications"
        message={`Delete ${selectedIds.length} applications? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleConfirmBulkDelete}
        onCancel={() => setBulkDeleteOpen(false)}
      />
    </div>
  );
}
