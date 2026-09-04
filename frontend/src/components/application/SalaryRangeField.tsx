import { useState } from 'react';
import { Input } from '../../components/ui/Input';
import { salaryRangeInputSchema } from '../../lib/validation';

const UNDISCLOSED = 'Undisclosed';

type ParsedSalary = { low: string; high: string; undisclosed: boolean };

function parseSalaryRange(value: string): ParsedSalary {
  const trimmed = value.trim();
  if (!trimmed) return { low: '', high: '', undisclosed: false };
  if (trimmed.toLowerCase() === UNDISCLOSED.toLowerCase()) {
    return { low: '', high: '', undisclosed: true };
  }
  const match = trimmed.match(/^([\d,]+)\s*-\s*([\d,]+)$/);
  if (match) {
    return { low: match[1].replace(/,/g, ''), high: match[2].replace(/,/g, ''), undisclosed: false };
  }
  // Doesn't match the structured shape (e.g. a legacy free-text value) —
  // fall back to blank rather than guessing.
  return { low: '', high: '', undisclosed: false };
}

function formatSalaryRange({ low, high, undisclosed }: ParsedSalary): string {
  if (undisclosed) return UNDISCLOSED;
  const formattedLow = low ? Number(low).toLocaleString('en-US') : '';
  const formattedHigh = high ? Number(high).toLocaleString('en-US') : '';
  if (formattedLow && formattedHigh) return `${formattedLow} - ${formattedHigh}`;
  return formattedLow || formattedHigh;
}

type SalaryRangeFieldProps = {
  value: string;
  onChange: (value: string) => void;
  error?: string;
};

export function SalaryRangeField({ value, onChange, error }: SalaryRangeFieldProps) {
  const [state, setState] = useState<ParsedSalary>(() => parseSalaryRange(value));
  const [localError, setLocalError] = useState<string | null>(null);

  // Re-sync local state when `value` changes for a reason other than this
  // component's own onChange — e.g. the outer form calling reset() to load a
  // different record. This adjusts state during render (React's documented
  // pattern for "state derived from a prop"), not inside an effect: an
  // effect here would re-run a tick after commit and race the user's typing.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setState(parseSalaryRange(value));
  }

  const commit = (next: ParsedSalary) => {
    setState(next);

    if (next.undisclosed) {
      setLocalError(null);
      const formatted = formatSalaryRange(next);
      setLastValue(formatted);
      onChange(formatted);
      return;
    }

    const result = salaryRangeInputSchema.safeParse({ low: next.low, high: next.high });
    if (!result.success) {
      setLocalError(result.error.issues[0].message);
      return;
    }

    setLocalError(null);
    const formatted = formatSalaryRange(next);
    setLastValue(formatted);
    onChange(formatted);
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Salary — Low"
          inputMode="numeric"
          disabled={state.undisclosed}
          value={state.low}
          onChange={(e) => commit({ ...state, low: e.target.value.replace(/[^\d]/g, '') })}
        />
        <Input
          label="Salary — High"
          inputMode="numeric"
          disabled={state.undisclosed}
          value={state.high}
          onChange={(e) => commit({ ...state, high: e.target.value.replace(/[^\d]/g, '') })}
        />
      </div>

      <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
        <input
          type="checkbox"
          checked={state.undisclosed}
          onChange={(e) => commit({ low: '', high: '', undisclosed: e.target.checked })}
          className="h-3.5 w-3.5 rounded border-slate-300"
        />
        Undisclosed
      </label>

      {(localError || error) && (
        <p role="alert" className="mt-1 text-xs text-rose-600">
          {localError ?? error}
        </p>
      )}
    </div>
  );
}
