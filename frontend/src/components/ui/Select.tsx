import type { SelectHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';
import { FormField } from './FormField';

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
  return (
    <FormField label={label} error={error} required={required} hint={hint} id={id}>
      {(fieldProps) => (
        <select
          {...fieldProps}
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
      )}
    </FormField>
  );
}
