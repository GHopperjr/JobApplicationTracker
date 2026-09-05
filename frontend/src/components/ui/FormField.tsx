import { useId, type ReactNode } from 'react';

export type FieldRenderProps = {
  id: string;
  'aria-invalid': boolean;
  'aria-describedby'?: string;
};

type FormFieldProps = {
  label: string;
  error?: string;
  required?: boolean;
  hint?: string;
  id?: string;
  children: (fieldProps: FieldRenderProps) => ReactNode;
};

/**
 * Shared label/error/hint wrapper + id wiring for Input, Select, and
 * Textarea — those three otherwise repeat this exact shell three times.
 * The actual control is rendered via a render prop so this component never
 * needs to know which element it's wrapping.
 */
export function FormField({ label, error, required, hint, id, children }: FormFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const errorId = error ? `${fieldId}-error` : undefined;
  const hintId = hint ? `${fieldId}-hint` : undefined;

  return (
    <div>
      <label htmlFor={fieldId} className="mb-1 block text-xs font-medium text-slate-600">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {children({
        id: fieldId,
        'aria-invalid': Boolean(error),
        'aria-describedby': errorId ?? hintId,
      })}
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
