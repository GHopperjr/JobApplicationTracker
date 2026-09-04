import { useId, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

type InputProps = {
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
} & InputHTMLAttributes<HTMLInputElement>;

export function Input({ label, error, required, hint, id, className, ...rest }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;
  const hintId = hint ? `${inputId}-hint` : undefined;

  return (
    <div>
      <label htmlFor={inputId} className="mb-1 block text-xs font-medium text-slate-600">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      <input
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId ?? hintId}
        className={cn(
          'w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900',
          'focus:border-transparent focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1',
          error && 'border-rose-300',
          className
        )}
        {...rest}
      />
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
