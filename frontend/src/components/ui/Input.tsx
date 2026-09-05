import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { FormField } from './FormField';

type InputProps = {
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
  /** Rendered inside the field, right-aligned (e.g. a password show/hide
   * toggle) — centralized here rather than duplicated at each call site. */
  trailing?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>;

export function Input({ label, error, required, hint, trailing, id, className, ...rest }: InputProps) {
  return (
    <FormField label={label} error={error} required={required} hint={hint} id={id}>
      {(fieldProps) => (
        <div className="relative">
          <input
            {...fieldProps}
            className={cn(
              'w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900',
              'focus:border-transparent focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1',
              error && 'border-rose-300',
              trailing && 'pr-14',
              className
            )}
            {...rest}
          />
          {trailing && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-2">{trailing}</div>
          )}
        </div>
      )}
    </FormField>
  );
}
