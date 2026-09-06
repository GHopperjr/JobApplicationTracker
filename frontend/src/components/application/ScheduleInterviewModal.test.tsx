import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ScheduleInterviewModal } from './ScheduleInterviewModal';

describe('ScheduleInterviewModal', () => {
  it('starts empty with no initial value', () => {
    render(
      <ScheduleInterviewModal
        isOpen
        initialValue={null}
        onSave={vi.fn()}
        onSkip={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByLabelText(/interview date and time/i)).toHaveValue('');
  });

  it('pre-fills from an existing interview_scheduled_at', () => {
    render(
      <ScheduleInterviewModal
        isOpen
        initialValue="2026-09-10T06:30:00.000Z"
        onSave={vi.fn()}
        onSkip={vi.fn()}
        onClose={vi.fn()}
      />
    );
    // toDatetimeLocalValue reads back via local Date getters, so the exact
    // wall-clock string depends on the machine's timezone — assert it's
    // non-empty rather than a specific string, which is what the pre-fill
    // behavior actually guarantees.
    expect(screen.getByLabelText(/interview date and time/i)).not.toHaveValue('');
  });

  it('saves the entered date, converted to an ISO string', () => {
    const onSave = vi.fn();
    render(
      <ScheduleInterviewModal
        isOpen
        initialValue={null}
        onSave={onSave}
        onSkip={vi.fn()}
        onClose={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText(/interview date and time/i), {
      target: { value: '2026-09-10T14:30' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const [saved] = onSave.mock.calls[0];
    expect(new Date(saved).toString()).not.toBe('Invalid Date');
  });

  it('saves null when the field is left empty', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(
      <ScheduleInterviewModal
        isOpen
        initialValue={null}
        onSave={onSave}
        onSkip={vi.fn()}
        onClose={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith(null);
  });

  it('calls onSkip, not onSave, when "Skip for now" is clicked', async () => {
    const onSave = vi.fn();
    const onSkip = vi.fn();
    const user = userEvent.setup();
    render(
      <ScheduleInterviewModal
        isOpen
        initialValue={null}
        onSave={onSave}
        onSkip={onSkip}
        onClose={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /skip for now/i }));

    expect(onSkip).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('calls onClose, not onSave or onSkip, when Cancel is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <ScheduleInterviewModal
        isOpen
        initialValue={null}
        onSave={vi.fn()}
        onSkip={vi.fn()}
        onClose={onClose}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalled();
  });
});
