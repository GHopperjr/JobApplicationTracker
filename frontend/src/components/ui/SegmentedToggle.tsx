import { cn } from '../../lib/cn';

type SegmentedToggleProps<T extends string> = {
  ariaLabel: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

// Shared two-(or-more)-segment pill control behind ViewToggle (Board/Table)
// and LoginPage's sign-in/sign-up switch — same visual language wherever the
// app needs "pick exactly one of a few named options" (docs/04-design-system.md).
export function SegmentedToggle<T extends string>({
  ariaLabel,
  options,
  value,
  onChange,
  className,
}: SegmentedToggleProps<T>) {
  return (
    // Full-width, evenly-split segments below the `sm:` breakpoint — callers
    // that need content-width on desktop (AppShell's header row) get it via
    // `sm:inline-flex sm:w-auto`; callers that want it full-width everywhere
    // (a standalone form) simply don't rely on that override.
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        'flex w-full rounded-md border border-slate-200 p-0.5 sm:inline-flex sm:w-auto',
        className
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'flex h-11 flex-1 items-center justify-center rounded px-3 text-sm font-medium transition-colors duration-100 sm:h-auto sm:flex-none sm:py-1',
            value === option.value ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
