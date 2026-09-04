import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ApplicationDetailDrawer } from '../components/application/ApplicationDetailDrawer';
import { ApplicationFormModal } from '../components/application/ApplicationFormModal';
import { FilterBar } from '../components/filters/FilterBar';
import { KanbanBoard } from '../components/kanban/KanbanBoard';
import { ApplicationsTable } from '../components/table/ApplicationsTable';
import { TableToolbar } from '../components/table/TableToolbar';
import { ROUTES } from '../constants/routes';
import { useApplicationFilters } from '../hooks/useApplicationFilters';
import { useApplicationForm } from '../hooks/useApplicationForm';
import { useApplications } from '../hooks/useApplications';
import { DEFAULT_SORT } from '../services/applicationsService';

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
  const { formState, close } = useApplicationForm();

  const openDetail = (appId: string) =>
    navigate({ pathname: ROUTES.application(appId), search: location.search });
  const closeDetail = () =>
    navigate({ pathname: ROUTES.applications, search: location.search });

  const detailApplication = id ? applications.find((a) => a.id === id) : undefined;

  return (
    <div className="pb-8">
      <FilterBar filters={filters} onChange={setFilters} />

      {view === 'kanban' ? (
        <KanbanBoard
          byStatus={byStatus}
          isLoading={isLoading}
          onCardClick={openDetail}
          statusFilter={filters.status}
        />
      ) : (
        <>
          <TableToolbar count={applications.length} />
          <div className="px-6 pt-3">
            <ApplicationsTable
              applications={applications}
              isLoading={isLoading}
              sort={sort}
              onSortChange={setSort}
              onRowClick={openDetail}
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
      />
    </div>
  );
}
