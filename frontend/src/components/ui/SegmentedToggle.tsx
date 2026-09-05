import { motion } from 'motion/react';
import { useId } from 'react';
import { useMotionDuration } from '../../hooks/useMotionDuration';
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
  // `useId` rather than `ariaLabel` itself — layoutId must be unique across
  // the whole app, and two toggles could otherwise share an aria-label.
  const instanceId = useId();
  const duration = useMotionDuration(0.15);

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
      {options.map((option) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative flex h-11 flex-1 items-center justify-center rounded px-3 text-sm font-medium sm:h-auto sm:flex-none sm:py-1',
              !isActive && 'hover:bg-slate-100'
            )}
          >
            {/* The active background is one shared element that slides
                between segments (Motion's layout animation, keyed by
                layoutId) rather than each button just swapping its own
                color — matches how a real segmented control behaves. */}
            {isActive && (
              <motion.span
                layoutId={`${instanceId}-highlight`}
                className="absolute inset-0 rounded bg-slate-900"
                transition={{ duration, ease: 'easeOut' }}
              />
            )}
            <span
              className={cn(
                'relative z-10 transition-colors duration-100',
                isActive ? 'text-white' : 'text-slate-600'
              )}
            >
              {option.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
