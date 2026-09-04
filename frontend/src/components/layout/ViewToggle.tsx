import { cn } from '../../lib/cn';

type ViewToggleProps = {
  view: 'kanban' | 'table';
  onChange: (view: 'kanban' | 'table') => void;
};

const OPTIONS: { value: 'kanban' | 'table'; label: string }[] = [
  { value: 'kanban', label: 'Board' },
  { value: 'table', label: 'Table' },
];

export function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div role="group" aria-label="View" className="inline-flex rounded-md border border-slate-200 p-0.5">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={view === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'flex h-11 items-center rounded px-3 text-sm font-medium transition-colors duration-100 sm:h-auto sm:py-1',
            view === option.value
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
