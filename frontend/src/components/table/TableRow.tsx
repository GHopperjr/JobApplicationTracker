import { ApplicationActions } from '../../components/application/ApplicationActions';
import { DistanceBadge } from '../../components/application/DistanceBadge';
import { StaleIndicator } from '../../components/application/StaleIndicator';
import { PLATFORM_LABELS } from '../../constants/platforms';
import { STATUS_LABELS, STATUS_ORDER, STATUS_STYLES, type ApplicationStatus } from '../../constants/status';
import { WORK_SETUP_LABELS } from '../../constants/workSetup';
import { cn } from '../../lib/cn';
import { formatDate } from '../../lib/format';
import type { Application } from '../../services/applicationsService';

type TableRowProps = {
  application: Application;
  onRowClick: (id: string) => void;
  onEdit: (application: Application) => void;
  onDelete: (application: Application) => void;
  onStatusChange: (id: string, status: ApplicationStatus) => void;
  onArchive?: (application: Application) => void;
  staleThresholdDays?: number | null;
  /** The archive view's own muted treatment — opacity, demoted company-name
   * weight, no drag (docs/04-design-system.md). Every row in that view is
   * archived by construction, so this is a view-level flag, not a per-row
   * check of `application.is_archived`. */
  isArchiveView?: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
};

export function TableRow({
  application,
  onRowClick,
  onEdit,
  onDelete,
  onStatusChange,
  onArchive,
  staleThresholdDays,
  isArchiveView = false,
  selected,
  onToggleSelect,
}: TableRowProps) {
  const style = STATUS_STYLES[application.status];

  return (
    <tr
      onClick={() => onRowClick(application.id)}
      className={cn(
        'cursor-pointer border-b border-slate-100 transition-colors duration-100 hover:bg-slate-50',
        selected && 'bg-slate-50',
        isArchiveView && 'opacity-60'
      )}
    >
      <td className="w-8 px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          aria-label={`Select ${application.company_name}`}
          checked={selected}
          onChange={() => onToggleSelect(application.id)}
          className="h-4 w-4 rounded border-slate-300"
        />
      </td>
      <td
        className={cn(
          'px-3 py-2.5 text-sm font-semibold',
          isArchiveView ? 'text-slate-600' : 'text-slate-900'
        )}
      >
        {application.company_name}
      </td>
      <td className="px-3 py-2.5 text-sm text-slate-600">{application.job_title}</td>
      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
        <select
          aria-label={`Status for ${application.company_name}`}
          value={application.status}
          onChange={(e) => onStatusChange(application.id, e.target.value as ApplicationStatus)}
          className={cn(
            'rounded-full border-0 px-2 py-0.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1',
            style.badge
          )}
        >
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2.5 text-sm text-slate-600">{PLATFORM_LABELS[application.platform_source]}</td>
      <td className="px-3 py-2.5 text-sm text-slate-600">
        <div className="flex items-center gap-1.5">
          <span className="truncate">{application.location}</span>
          <DistanceBadge application={application} />
        </div>
      </td>
      <td className="px-3 py-2.5 text-sm text-slate-600">
        {application.work_setup ? WORK_SETUP_LABELS[application.work_setup] : ''}
      </td>
      <td className="px-3 py-2.5 text-sm text-slate-600 tabular-nums">
        <div className="flex items-center gap-1.5">
          <StaleIndicator application={application} thresholdDays={staleThresholdDays ?? null} />
          {application.applied_date && formatDate(application.applied_date)}
        </div>
      </td>
      <td className="px-3 py-2.5 text-sm text-slate-600">{application.salary_range}</td>
      <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
        <ApplicationActions
          application={application}
          onEdit={onEdit}
          onDelete={onDelete}
          onArchive={onArchive}
          className="w-32 text-left"
        />
      </td>
    </tr>
  );
}
