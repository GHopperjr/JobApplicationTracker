import { useId, useState } from 'react';
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '../../lib/format';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

type ScheduleInterviewModalProps = {
  isOpen: boolean;
  /** The application's current interview_scheduled_at, if any — pre-fills
   * the field so re-opening this (e.g. moving back to Scheduled after a
   * correction) doesn't ask the user to re-enter a date they'd already set.
   * Always null for a bulk change (docs/05). */
  initialValue: string | null;
  onSave: (interviewScheduledAt: string | null) => void;
  /** Moves the card with no date argument at all, leaving whatever was
   * already there untouched — distinct from Save with an empty field, which
   * explicitly clears it. */
  onSkip: () => void;
  /** Aborts the status change entirely; the card stays where it was. */
  onClose: () => void;
};

export function ScheduleInterviewModal({
  isOpen,
  initialValue,
  onSave,
  onSkip,
  onClose,
}: ScheduleInterviewModalProps) {
  const inputId = useId();
  const [value, setValue] = useState(() => toDatetimeLocalValue(initialValue));

  // Render-time sync, not an effect: reset whenever the modal (re)opens
  // with a (possibly different) initial value, the same pattern
  // ApplicationFormModal and DistanceRow use elsewhere in this codebase.
  const syncKey = `${isOpen}:${initialValue ?? ''}`;
  const [lastSyncKey, setLastSyncKey] = useState(syncKey);
  if (syncKey !== lastSyncKey) {
    setLastSyncKey(syncKey);
    setValue(toDatetimeLocalValue(initialValue));
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Schedule interview"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="ghost" onClick={onSkip}>
            Skip for now
          </Button>
          <Button variant="primary" onClick={() => onSave(fromDatetimeLocalValue(value))}>
            Save
          </Button>
        </div>
      }
    >
      <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-slate-700">
        Interview date and time
      </label>
      <input
        id={inputId}
        type="datetime-local"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900"
      />
      <p className="mt-2 text-xs text-slate-500">
        Optional — skip this and add it later from the application's details if you don't have it
        yet.
      </p>
    </Modal>
  );
}
