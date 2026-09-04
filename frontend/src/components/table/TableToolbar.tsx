import { STATUS_LABELS, STATUS_ORDER, type ApplicationStatus } from '../../constants/status';
import { Button } from '../ui/Button';

type TableToolbarProps = {
  count: number;
  selectedCount: number;
  onBulkStatusChange: (status: ApplicationStatus) => void;
  onBulkDelete: () => void;
  onClearSelection: () => void;
};

export function TableToolbar({
  count,
  selectedCount,
  onBulkStatusChange,
  onBulkDelete,
  onClearSelection,
}: TableToolbarProps) {
  if (selectedCount > 0) {
    return (
      <div className="flex items-center gap-3 px-6 pt-4 text-sm">
        <span className="font-medium text-slate-900">{selectedCount} selected</span>

        <select
          aria-label="Change status for selected applications"
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) onBulkStatusChange(e.target.value as ApplicationStatus);
            e.target.value = '';
          }}
          className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1"
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

        <Button variant="destructive" size="sm" onClick={onBulkDelete}>
          Delete
        </Button>

        <button
          type="button"
          onClick={onClearSelection}
          className="text-xs text-slate-500 hover:text-slate-700"
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
