import { STATUS_LABELS, STATUS_ORDER, type ApplicationStatus } from '../../constants/status';
import { Button } from '../ui/Button';

type TableToolbarProps = {
  count: number;
  selectedCount: number;
  onBulkStatusChange: (status: ApplicationStatus) => void;
  onBulkArchive: () => void;
  onBulkDelete: () => void;
  onClearSelection: () => void;
  isArchiveView?: boolean;
};

export function TableToolbar({
  count,
  selectedCount,
  onBulkStatusChange,
  onBulkArchive,
  onBulkDelete,
  onClearSelection,
  isArchiveView = false,
}: TableToolbarProps) {
  if (selectedCount > 0) {
    return (
      <div className="flex flex-wrap items-center gap-3 px-6 pt-4 text-sm">
        <span className="font-medium text-slate-900">{selectedCount} selected</span>

        {/* Bulk status change makes no sense on archived rows — restore
            them first (docs/05 F9: archive does not change status). */}
        {!isArchiveView && (
          <select
            aria-label="Change status for selected applications"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) onBulkStatusChange(e.target.value as ApplicationStatus);
              e.target.value = '';
            }}
            className="h-11 rounded-md border border-slate-200 px-2 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1 sm:h-auto sm:py-1"
          >
            <option value="" disabled>
              Change status…
            </option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        )}

        <Button variant="secondary" size="sm" onClick={onBulkArchive}>
          {isArchiveView ? 'Restore' : 'Archive'}
        </Button>

        <Button variant="destructive" size="sm" onClick={onBulkDelete}>
          Delete
        </Button>

        <button
          type="button"
          onClick={onClearSelection}
          className="flex h-11 items-center text-xs text-slate-500 hover:text-slate-700 sm:h-auto"
        >
          Clear selection
        </button>
      </div>
    );
  }

  return (
    <div className="px-6 pt-4 text-xs text-slate-500">
      {count} {count === 1 ? 'application' : 'applications'}
    </div>
  );
}
