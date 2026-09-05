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
      className="flex items-start gap-1 border-b border-slate-100 px-2 py-2"
    >
      <span
        onClick={(e) => e.stopPropagation()}
        className="flex h-11 w-11 shrink-0 items-center justify-center"
      >
        <input
          type="checkbox"
          aria-label={`Select ${application.company_name}`}
          checked={selected}
          onChange={() => onToggleSelect(application.id)}
          className="h-5 w-5 rounded border-slate-300"
        />
      </span>

      {/* Status gets its own line rather than sitting beside the company
          name — squeezing both onto one row forced whichever one lost the
          truncation fight to wrap mid-word instead. */}
      <div className="min-w-0 flex-1 py-1">
        <h3 className="truncate text-sm font-semibold text-slate-900">
          {application.company_name}
        </h3>
        <p className="truncate text-sm text-slate-600">{application.job_title}</p>
        <div className="mt-1.5 flex items-center gap-2">
          <StatusBadge status={application.status} />
        </div>
        <p className="mt-1.5 truncate text-xs text-slate-500">
          {PLATFORM_LABELS[application.platform_source]}
          {application.location && ` · ${application.location}`}
          {application.applied_date && ` · ${formatDate(application.applied_date)}`}
        </p>
      </div>

      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
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
