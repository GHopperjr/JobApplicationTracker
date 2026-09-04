import { useSearchParams } from 'react-router-dom';
import { ApplicationFormModal } from '../components/application/ApplicationFormModal';
import { KanbanBoard } from '../components/kanban/KanbanBoard';
import { ApplicationsTable } from '../components/table/ApplicationsTable';
import { TableToolbar } from '../components/table/TableToolbar';
import { useApplicationForm } from '../hooks/useApplicationForm';
import { useApplications } from '../hooks/useApplications';

export function ApplicationsPage() {
  const [searchParams] = useSearchParams();
  const view = searchParams.get('view') === 'table' ? 'table' : 'kanban';

  const { applications, byStatus, isLoading } = useApplications();
  const { formState, close } = useApplicationForm();

  return (
    <div className="pb-8">
      {view === 'kanban' ? (
        <KanbanBoard byStatus={byStatus} isLoading={isLoading} />
      ) : (
        <>
          <TableToolbar count={applications.length} />
          <div className="px-6 pt-3">
            <ApplicationsTable applications={applications} isLoading={isLoading} />
          </div>
        </>
      )}

      <ApplicationFormModal
        isOpen={formState.mode !== 'closed'}
        application={formState.mode === 'edit' ? formState.application : undefined}
        onClose={close}
      />
    </div>
  );
}
