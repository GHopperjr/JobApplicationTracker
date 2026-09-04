import { useId, type SelectHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type SelectProps = {
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
} & SelectHTMLAttributes<HTMLSelectElement>;

export function Select({
  label,
  error,
  required,
  hint,
  id,
  className,
  children,
  ...rest
}: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const errorId = error ? `${selectId}-error` : undefined;
  const hintId = hint ? `${selectId}-hint` : undefined;

  return (
    <div>
      <label htmlFor={selectId} className="mb-1 block text-xs font-medium text-slate-600">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      <select
        id={selectId}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId ?? hintId}
        className={cn(
          'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900',
          'focus:border-transparent focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1',
          error && 'border-rose-300',
          className
        )}
        {...rest}
      >
        {children}
      </select>
      {error && (
        <p id={errorId} className="mt-1 text-xs text-rose-600">
          {error}
        </p>
      )}
      {!error && hint && (
        <p id={hintId} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      )}
    </div>
  );
}
