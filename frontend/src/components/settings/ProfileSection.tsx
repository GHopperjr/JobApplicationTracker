import { useState, type FormEvent } from 'react';
import { EXPERIENCE_LEVEL_LABELS } from '../../constants/experienceLevel';
import { useToast } from '../../hooks/useToast';
import { useUserPreferences } from '../../hooks/useUserPreferences';
import { computeExperienceLevel, monthsSince } from '../../lib/experienceLevel';
import { Button } from '../ui/Button';

/**
 * A single-field settings form for the graduation date
 * (docs/13-profile-and-experience-filtering.md) — the same render-time
 * sync pattern as GoalSettings, for the same reason: a single preference
 * loaded asynchronously, not a multi-field entity react-hook-form usually
 * handles here.
 */
export function ProfileSection() {
  const { graduationDate, isLoading, setGraduationDate, isSaving } = useUserPreferences();
  const { show } = useToast();

  const [draft, setDraft] = useState('');
  // `undefined` means "not yet synced" — distinct from a real `null` date,
  // so the sync fires exactly once per loaded value, not on every render.
  const [lastSyncedDate, setLastSyncedDate] = useState<string | null | undefined>(undefined);
  if (!isLoading && graduationDate !== lastSyncedDate) {
    setLastSyncedDate(graduationDate);
    setDraft(graduationDate ?? '');
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await setGraduationDate(draft || null);
      show('Profile saved.');
    } catch {
      show("Couldn't save your profile. Please try again.", 'error');
    }
  };

  // Derived from the draft, not the saved value — the stage preview
  // updates as soon as the date changes, before Save is even clicked.
  const stage = computeExperienceLevel(draft || null);
  const months = draft ? monthsSince(draft) : 0;

  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-900">Profile</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        Used to filter applications to roles aimed at your career stage. Leave blank to skip this.
      </p>

      <form onSubmit={handleSubmit} className="mt-3 flex items-start gap-2">
        <div>
          <input
            type="date"
            aria-label="Graduation date"
            disabled={isLoading}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-900"
          />
          {/* Read-only, deliberately — the stage is a consequence of the
              date, and a control to edit it directly would recreate the
              stale-category problem this design exists to avoid. */}
          {stage && (
            <p className="mt-1 text-xs text-slate-500">
              Currently: {EXPERIENCE_LEVEL_LABELS[stage]}
              {months > 0 && ` — ${months} month${months === 1 ? '' : 's'} since graduating`}
            </p>
          )}
        </div>
        <Button type="submit" variant="secondary" disabled={isLoading || isSaving}>
          Save
        </Button>
      </form>
    </section>
  );
}
