import { cn } from '../../lib/cn';

type MultiSelectFilterProps<T extends string> = {
  ariaLabel: string;
  options: readonly T[];
  labels: Record<T, string>;
  selected: T[];
  onChange: (selected: T[]) => void;
};

/** Shared toggle-chip logic behind StatusFilter and PlatformFilter. */
export function MultiSelectFilter<T extends string>({
  ariaLabel,
  options,
  labels,
  selected,
  onChange,
}: MultiSelectFilterProps<T>) {
  const toggle = (value: T) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };

  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-1.5">
      {options.map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={selected.includes(value)}
          onClick={() => toggle(value)}
          className={cn(
            'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-100',
            selected.includes(value)
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          )}
        >
          {labels[value]}
        </button>
      ))}
    </div>
  );
}
