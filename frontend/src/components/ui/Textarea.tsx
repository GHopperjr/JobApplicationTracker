import type { TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';
import { FormField } from './FormField';

type TextareaProps = {
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
} & TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({
  label,
  error,
  required,
  hint,
  id,
  className,
  rows = 3,
  ...rest
}: TextareaProps) {
  return (
    <FormField label={label} error={error} required={required} hint={hint} id={id}>
      {(fieldProps) => (
        <textarea
          {...fieldProps}
          rows={rows}
          className={cn(
            'w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900',
            'focus:border-transparent focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1',
            error && 'border-rose-300',
            className
          )}
          {...rest}
        />
      )}
    </FormField>
  );
}
