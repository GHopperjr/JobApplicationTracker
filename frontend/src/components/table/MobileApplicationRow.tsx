import { ApplicationActions } from '../../components/application/ApplicationActions';
import { StatusBadge } from '../../components/application/StatusBadge';
import { PLATFORM_LABELS } from '../../constants/platforms';
import type { ApplicationStatus } from '../../constants/status';
import { formatDate } from '../../lib/format';
import type { Application } from '../../services/applicationsService';

type MobileApplicationRowProps = {
  application: Application;
  onRowClick: (id: string) => void;
  onEdit: (application: Application) => void;
  onDelete: (application: Application) => void;
  onStatusChange: (id: string, status: ApplicationStatus) => void;
  selected: boolean;
  onToggleSelect: (id: string) => void;
};

// The table degrades to a stacked card list on mobile — never a
// horizontally scrolling table, which is unusable on a phone
// (docs/04-design-system.md).
export function MobileApplicationRow({
  application,
  onRowClick,
  onEdit,
  onDelete,
  onStatusChange,
  selected,
  onToggleSelect,
}: MobileApplicationRowProps) {
  return (
    <div
      onClick={() => onRowClick(application.id)}
      className="flex items-start gap-3 border-b border-slate-100 px-4 py-3"
    >
      <input
        type="checkbox"
        aria-label={`Select ${application.company_name}`}
        checked={selected}
        onChange={(e) => {
          e.stopPropagation();
          onToggleSelect(application.id);
        }}
        onClick={(e) => e.stopPropagation()}
        className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300"
      />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-sm font-semibold text-slate-900">
            {application.company_name}
          </h3>
          <StatusBadge status={application.status} />
        </div>
        <p className="truncate text-sm text-slate-600">{application.job_title}</p>
        <p className="mt-1 truncate text-xs text-slate-500">
          {PLATFORM_LABELS[application.platform_source]}
          {application.location && ` · ${application.location}`}
          {application.applied_date && ` · ${formatDate(application.applied_date)}`}
        </p>
      </div>

      <div onClick={(e) => e.stopPropagation()}>
        <ApplicationActions
          application={application}
          onEdit={onEdit}
          onDelete={onDelete}
          onStatusChange={onStatusChange}
          showMoveTo
          className="w-40 text-left"
        />
      </div>
    </div>
  );
}
