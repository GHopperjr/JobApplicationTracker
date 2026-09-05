import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type ChipProps = {
  active?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * The pill-shaped button behind every toggle/filter/dropdown-trigger chip in
 * the filter bar (Status/Platform options, the stale-follow-up toggle, the
 * Show/Reminder/More triggers, the mobile Filters sheet's pills) — one place
 * for the active/inactive color pairing so a tweak doesn't need hunting
 * across every call site.
 */
export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { active = false, className, children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        'inline-flex min-h-11 shrink-0 items-center justify-center gap-1 rounded-full border px-3 text-xs font-medium transition-colors duration-100 sm:min-h-0 sm:px-2.5 sm:py-1',
        active
          ? 'border-slate-900 bg-slate-900 text-white'
          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
