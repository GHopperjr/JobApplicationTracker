import { Chip } from './Chip';

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
        <Chip
          key={value}
          active={selected.includes(value)}
          aria-pressed={selected.includes(value)}
          onClick={() => toggle(value)}
        >
          {labels[value]}
        </Chip>
      ))}
    </div>
  );
}
