import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import type { ApplicationStatus } from '../../constants/status';
import { useApplicationForm } from '../../hooks/useApplicationForm';
import { useIsMobile } from '../../hooks/useMediaQuery';
import type {
  Application,
  ApplicationSort,
  SortField,
} from '../../services/applicationsService';
import { MobileApplicationRow } from './MobileApplicationRow';
import { TableRow } from './TableRow';

const COLUMNS: { label: string; field?: SortField }[] = [
  { label: 'Company', field: 'company_name' },
  { label: 'Job Title', field: 'job_title' },
  { label: 'Status', field: 'status' },
  { label: 'Platform', field: 'platform_source' },
  { label: 'Location' },
  { label: 'Work Setup' },
  { label: 'Applied', field: 'applied_date' },
  { label: 'Salary' },
  { label: '' },
];

type ApplicationsTableProps = {
  applications: Application[];
  isLoading: boolean;
  sort: ApplicationSort;
  onSortChange: (sort: ApplicationSort) => void;
  onRowClick: (id: string) => void;
  onEdit: (application: Application) => void;
  onDelete: (application: Application) => void;
  onStatusChange: (id: string, status: ApplicationStatus) => void;
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
};

export function ApplicationsTable({
  applications,
  isLoading,
  sort,
  onSortChange,
  onRowClick,
  onEdit,
  onDelete,
  onStatusChange,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
}: ApplicationsTableProps) {
  const { openCreate } = useApplicationForm();
  const isMobile = useIsMobile();

  if (isLoading) {
    return (
      <div className="overflow-x-auto">
        <Skeleton variant="row" count={5} />
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <EmptyState
        message="No applications match these filters."
        action={{ label: 'Add your first application', onClick: openCreate }}
      />
    );
  }

  const handleHeaderClick = (field: SortField) => {
    onSortChange({
      field,
      direction: sort.field === field && sort.direction === 'asc' ? 'desc' : 'asc',
    });
  };

  const allSelected = applications.length > 0 && selectedIds.length === applications.length;

  if (isMobile) {
    return (
      <div>
        {applications.map((application) => (
          <MobileApplicationRow
            key={application.id}
            application={application}
            onRowClick={onRowClick}
            onEdit={onEdit}
            onDelete={onDelete}
            onStatusChange={onStatusChange}
            selected={selectedIds.includes(application.id)}
            onToggleSelect={onToggleSelect}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] border-collapse">
        <thead>
          <tr className="border-b border-slate-200 text-xs font-medium uppercase tracking-wide text-slate-600">
            <th scope="col" className="w-8 px-3 py-2.5">
              <input
                type="checkbox"
                aria-label="Select all applications"
                checked={allSelected}
                onChange={onToggleSelectAll}
                className="h-4 w-4 rounded border-slate-300"
              />
            </th>
            {COLUMNS.map((col) =>
              col.field ? (
                <th key={col.label} scope="col" className="px-3 py-2.5 text-left">
                  <button
                    type="button"
                    onClick={() => handleHeaderClick(col.field!)}
                    className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-slate-900"
                  >
                    {col.label}
                    {sort.field === col.field && <span>{sort.direction === 'asc' ? '▲' : '▼'}</span>}
                  </button>
                </th>
              ) : (
                <th key={col.label} scope="col" className="px-3 py-2.5 text-left">
                  {col.label}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {applications.map((application) => (
            <TableRow
              key={application.id}
              application={application}
              onRowClick={onRowClick}
              onEdit={onEdit}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
              selected={selectedIds.includes(application.id)}
              onToggleSelect={onToggleSelect}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
