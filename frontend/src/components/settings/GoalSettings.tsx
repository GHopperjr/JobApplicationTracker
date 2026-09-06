import { useId, useState, type FormEvent } from 'react';
import { z } from 'zod';
import { useToast } from '../../hooks/useToast';
import { useUserPreferences } from '../../hooks/useUserPreferences';
import { Button } from '../ui/Button';

// '' clears the goal (upsertMonthlyGoal(null)) — a blank field is a valid,
// deliberate way to stop tracking a goal, not a validation error.
const goalValueSchema = z.union([
  z.literal(''),
  z.string().regex(/^[1-9]\d*$/, 'Must be a whole number greater than 0'),
]);

/**
 * A single-field settings form for the monthly application goal
 * (docs/12-interview-metrics.md). Kept inline rather than a modal — one
 * number is not worth a dialog — and, since it's a single preference synced
 * from an async load rather than a multi-field entity edited from a fully-
 * loaded prop (react-hook-form's usual case in this app, e.g.
 * SavedLocationFormModal), it plugs the loaded goal into local state via a
 * render-time comparison instead: the same pattern DistanceRow.tsx uses to
 * react to a changed prop without an effect.
 */
export function GoalSettings() {
  const { goal, isLoading, setGoal, isSaving } = useUserPreferences();
  const { show } = useToast();
  const inputId = useId();

  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  // `undefined` means "not yet synced" — distinct from a real `null` goal,
  // so the sync below fires exactly once per loaded value, not on every
  // render.
  const [lastSyncedGoal, setLastSyncedGoal] = useState<number | null | undefined>(undefined);
  if (!isLoading && goal !== lastSyncedGoal) {
    setLastSyncedGoal(goal);
    setDraft(goal !== null ? String(goal) : '');
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = goalValueSchema.safeParse(draft.trim());
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Invalid value');
      return;
    }
    setError(null);
    try {
      await setGoal(result.data === '' ? null : Number(result.data));
      show('Goal saved.');
    } catch {
      show("Couldn't save your goal. Please try again.", 'error');
    }
  };

  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-900">Monthly application goal</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        Shown on the Interview Metrics page for This Month. Leave blank to stop tracking one.
      </p>

      <form onSubmit={handleSubmit} className="mt-3 flex items-start gap-2">
        <div>
          <input
            id={inputId}
            type="text"
            inputMode="numeric"
            aria-label="Monthly application goal"
            disabled={isLoading}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="w-24 rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-900"
          />
          {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
        </div>
        <Button type="submit" variant="secondary" disabled={isLoading || isSaving}>
          Save
        </Button>
      </form>
    </section>
  );
}
