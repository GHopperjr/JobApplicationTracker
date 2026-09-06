import { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ApplicationDetailDrawer } from '../components/application/ApplicationDetailDrawer';
import { ApplicationFormModal } from '../components/application/ApplicationFormModal';
import { ScheduleInterviewModal } from '../components/application/ScheduleInterviewModal';
import { FilterBar } from '../components/filters/FilterBar';
import { ImportModal } from '../components/import/ImportModal';
import { KanbanBoard } from '../components/kanban/KanbanBoard';
import { ApplicationsTable } from '../components/table/ApplicationsTable';
import { TableToolbar } from '../components/table/TableToolbar';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { ROUTES } from '../constants/routes';
import { STATUS_LABELS, STATUS_ORDER, type ApplicationStatus } from '../constants/status';
import { isStale } from '../constants/staleness';
import { useApplicationFilters } from '../hooks/useApplicationFilters';
import { useApplicationForm } from '../hooks/useApplicationForm';
import { useApplicationMutations } from '../hooks/useApplicationMutations';
import { useApplications } from '../hooks/useApplications';
import { useRealtimeApplications } from '../hooks/useRealtimeApplications';
import { useStaleThreshold } from '../hooks/useStaleThreshold';
import { useStatusChangeGuard } from '../hooks/useStatusChangeGuard';
import { useToast } from '../hooks/useToast';
import { downloadCsv, exportFilename } from '../lib/csv';
import { DEFAULT_SORT, listApplications, type Application } from '../services/applicationsService';

export function ApplicationsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { filters, sort, view, stale, setFilters, setSort, setStale } = useApplicationFilters();
  const { thresholdDays, setThresholdDays } = useStaleThreshold();

  // The archive view is table-only (docs/05 F9) — a Kanban board of
  // applications that aren't in the pipeline is a contradiction. AppShell
  // already hides the toggle for the same reason; this is the page's own
  // half of that rule.
  const isArchiveView = filters.archived === 'archived';
  const effectiveView = isArchiveView ? 'table' : view;

  // Kanban always uses DEFAULT_SORT and never varies it — only the Table
  // view exposes sort controls (docs/03-frontend-architecture.md). With the
  // table at its default sort, both views hit the identical query key, so
  // toggling between them triggers no refetch.
  const { applications, byStatus, isLoading } = useApplications(
    filters,
    effectiveView === 'table' ? sort : DEFAULT_SORT
  );
  const { formState, openEdit, close } = useApplicationForm();
  const { show } = useToast();

  useRealtimeApplications(); // mounted exactly once, here

  // Staleness has no server-side predicate — it's derived from
  // status_changed_at against a client-local threshold, so it filters the
  // already-fetched result set (docs/05 F7). Threshold Off (null) disables
  // the concept entirely regardless of the URL's ?stale= value.
  const staleCount = useMemo(
    () => (thresholdDays === null ? 0 : applications.filter((a) => isStale(a, thresholdDays)).length),
    [applications, thresholdDays]
  );
  const showStaleOnly = stale && thresholdDays !== null;
  const displayedApplications = useMemo(
    () => (showStaleOnly ? applications.filter((a) => isStale(a, thresholdDays!)) : applications),
    [applications, showStaleOnly, thresholdDays]
  );
  const displayedByStatus = useMemo(() => {
    if (!showStaleOnly) return byStatus;
    return Object.fromEntries(
      STATUS_ORDER.map((s) => [s, byStatus[s].filter((a) => isStale(a, thresholdDays!))])
    ) as Record<ApplicationStatus, Application[]>;
  }, [byStatus, showStaleOnly, thresholdDays]);

  // The page owns mutations and the delete-confirmation dialog — Card,
  // TableRow, and the Detail Drawer all receive onEdit/onDelete/
  // onStatusChange as props rather than calling these hooks themselves
  // (docs/03 and docs/07's composition contract).
  const mutations = useApplicationMutations({
    onDeleted: () => show('Application deleted.'),
    onStatusError: () => show("Couldn't update status. Please try again.", 'error'),
    onBulkStatusChanged: (count) => show(`Status updated for ${count} applications.`),
    onBulkDeleted: (count) => show(`${count} applications deleted.`),
    onArchived: (ids, isArchived) => {
      show(isArchived ? 'Archived.' : 'Restored.', 'success', {
        label: 'Undo',
        onClick: () => mutations.setArchived.mutate({ ids, isArchived: !isArchived }),
      });
    },
  });
  const [pendingDelete, setPendingDelete] = useState<Application | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // Export mirrors exactly what's on screen — same filters, sort, and
  // archived scope — so "current view" includes the client-only stale
  // filter too (docs/10-data-import-export.md Part 1). "All" ignores every
  // filter and re-fetches rather than reusing the cache, which is scoped to
  // the active view.
  const handleExportCurrent = async () => {
    try {
      await downloadCsv(displayedApplications, exportFilename());
    } catch {
      show("Couldn't export applications. Please try again.", 'error');
    }
  };
  const handleExportAll = async () => {
    try {
      const all = await listApplications({ archived: 'all' });
      await downloadCsv(all, exportFilename());
    } catch {
      show("Couldn't export applications. Please try again.", 'error');
    }
  };

  const openDetail = useCallback(
    (appId: string) => navigate({ pathname: ROUTES.application(appId), search: location.search }),
    [navigate, location.search]
  );
  const closeDetail = useCallback(
    () => navigate({ pathname: ROUTES.applications, search: location.search }),
    [navigate, location.search]
  );
  const confirmDelete = useCallback((application: Application) => setPendingDelete(application), []);
  // `mutations.changeStatus`/`mutations.bulkStatus` (the objects) are fresh
  // references every render — useMutation() returns `{...result, mutate}`
  // via spread — but `.mutate` itself is wrapped in its own internal
  // useCallback keyed on a stable observer, so it genuinely doesn't change
  // (verified directly against @tanstack/react-query's source, not
  // assumed). Depending on the whole object, as exhaustive-deps suggests,
  // would recreate these callbacks every render and defeat the memoization
  // ApplicationCard relies on them for.
  const rawChangeStatus = useCallback(
    (appId: string, status: ApplicationStatus, interviewScheduledAt?: string | null) =>
      mutations.changeStatus.mutate({ id: appId, status, interviewScheduledAt }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mutations.changeStatus.mutate]
  );
  // Selection is cleared here, not in handleBulkStatusChange below — the
  // guard may hold the change behind a modal first, and clearing the
  // selection before the user has actually decided anything would lose it
  // if they cancel.
  const rawBulkChangeStatus = useCallback(
    (ids: string[], status: ApplicationStatus, interviewScheduledAt?: string | null) => {
      mutations.bulkStatus.mutate({ ids, status, interviewScheduledAt });
      setSelectedIds([]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mutations.bulkStatus.mutate]
  );

  // The single interception point for every status-change path in the app
  // (docs/05): holds a forward stage-skip behind a confirmation, and a move
  // into Scheduled for Interview behind an optional date/time prompt,
  // before either mutation above ever fires.
  const guard = useStatusChangeGuard({
    applications,
    onChangeStatus: rawChangeStatus,
    onBulkChangeStatus: rawBulkChangeStatus,
  });
  const onStatusChange = guard.requestStatusChange;

  const onArchive = useCallback(
    (application: Application) =>
      mutations.setArchived.mutate({ ids: [application.id], isArchived: !application.is_archived }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mutations.setArchived.mutate]
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
    setSelectedIds((prev) =>
      prev.length === displayedApplications.length ? [] : displayedApplications.map((a) => a.id)
    );
  }, [displayedApplications]);
  const clearSelection = useCallback(() => setSelectedIds([]), []);

  const handleBulkStatusChange = (status: ApplicationStatus) => {
    guard.requestBulkStatusChange(selectedIds, status);
  };
  const handleBulkArchive = () => {
    // Direction follows the view, not each row's own state: every selected
    // row in the archive view is already archived, and every selected row
    // in the active view is not — there is no mixed case.
    mutations.setArchived.mutate({ ids: selectedIds, isArchived: !isArchiveView });
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
      <FilterBar
        filters={filters}
        onChange={setFilters}
        staleCount={staleCount}
        showStaleOnly={showStaleOnly}
        onToggleStaleOnly={() => setStale(!stale)}
        staleThresholdDays={thresholdDays}
        onChangeStaleThreshold={setThresholdDays}
        onExportCurrent={() => void handleExportCurrent()}
        onExportAll={() => void handleExportAll()}
        onOpenImport={() => setImportOpen(true)}
      />

      {effectiveView === 'kanban' ? (
        <KanbanBoard
          byStatus={displayedByStatus}
          isLoading={isLoading}
          onCardClick={openDetail}
          onEdit={openEdit}
          onDelete={confirmDelete}
          onStatusChange={onStatusChange}
          onArchive={onArchive}
          staleThresholdDays={thresholdDays}
          statusFilter={filters.status}
        />
      ) : (
        <>
          <TableToolbar
            count={displayedApplications.length}
            selectedCount={selectedIds.length}
            onBulkStatusChange={handleBulkStatusChange}
            onBulkArchive={handleBulkArchive}
            onBulkDelete={() => setBulkDeleteOpen(true)}
            onClearSelection={clearSelection}
            isArchiveView={isArchiveView}
          />
          <div className="px-6 pt-3">
            <ApplicationsTable
              applications={displayedApplications}
              isLoading={isLoading}
              sort={sort}
              onSortChange={setSort}
              onRowClick={openDetail}
              onEdit={openEdit}
              onDelete={confirmDelete}
              onStatusChange={onStatusChange}
              onArchive={onArchive}
              staleThresholdDays={thresholdDays}
              isArchiveView={isArchiveView}
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

      <ImportModal isOpen={importOpen} onClose={() => setImportOpen(false)} />

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
        onArchive={onArchive}
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

      <ConfirmDialog
        isOpen={Boolean(guard.skipConfirm)}
        title="Skip a stage?"
        message={guard.skipConfirm ? formatSkipConfirmMessage(guard.skipConfirm) : ''}
        confirmLabel="Continue"
        onConfirm={guard.confirmSkip}
        onCancel={guard.cancelSkip}
      />

      <ScheduleInterviewModal
        isOpen={guard.scheduleModalOpen}
        initialValue={guard.scheduleInitialValue}
        onSave={guard.saveSchedule}
        onSkip={guard.skipSchedule}
        onClose={guard.closeSchedule}
      />
    </div>
  );
}

function formatSkipConfirmMessage(skipConfirm: {
  skippedStages: ApplicationStatus[];
  count: number;
}): string {
  const labels = skipConfirm.skippedStages.map((s) => STATUS_LABELS[s]);
  const stageList =
    labels.length === 1 ? labels[0] : `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`;
  const subject = skipConfirm.count > 1 ? `${skipConfirm.count} applications will` : 'This will';
  return `${subject} skip ${stageList} without ever passing through ${labels.length > 1 ? 'them' : 'it'}. Continue?`;
}
