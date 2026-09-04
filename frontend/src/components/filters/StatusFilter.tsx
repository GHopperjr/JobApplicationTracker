import { STATUS_LABELS, STATUS_ORDER, type ApplicationStatus } from '../../constants/status';
import { cn } from '../../lib/cn';

type StatusFilterProps = {
  selected: ApplicationStatus[];
  onChange: (selected: ApplicationStatus[]) => void;
};

export function StatusFilter({ selected, onChange }: StatusFilterProps) {
  const toggle = (status: ApplicationStatus) => {
    onChange(
      selected.includes(status) ? selected.filter((s) => s !== status) : [...selected, status]
    );
  };

  return (
    <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
      {STATUS_ORDER.map((status) => (
        <button
          key={status}
          type="button"
          aria-pressed={selected.includes(status)}
          onClick={() => toggle(status)}
          className={cn(
            'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-100',
            selected.includes(status)
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          )}
        >
          {STATUS_LABELS[status]}
        </button>
      ))}
    </div>
  );
}
