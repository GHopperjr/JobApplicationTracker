import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { useApplicationForm } from '../../hooks/useApplicationForm';
import type { Application } from '../../services/applicationsService';
import { TableRow } from './TableRow';

const COLUMNS = [
  'Company',
  'Job Title',
  'Status',
  'Platform',
  'Location',
  'Work Setup',
  'Applied',
  'Salary',
  '',
];

type ApplicationsTableProps = {
  applications: Application[];
  isLoading: boolean;
};

export function ApplicationsTable({ applications, isLoading }: ApplicationsTableProps) {
  const { openCreate } = useApplicationForm();

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
        message="No applications yet."
        action={{ label: 'Add your first application', onClick: openCreate }}
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr className="border-b border-slate-200 text-xs font-medium uppercase tracking-wide text-slate-600">
            {COLUMNS.map((col) => (
              <th key={col} scope="col" className="px-3 py-2.5 text-left">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {applications.map((application) => (
            <TableRow key={application.id} application={application} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
