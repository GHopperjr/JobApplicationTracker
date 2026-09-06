import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/renderWithProviders';
import { GoalSettings } from './GoalSettings';

const getUserPreferences = vi.fn();
const upsertMonthlyGoal = vi.fn();
vi.mock('../../services/userPreferencesService', () => ({
  getUserPreferences: () => getUserPreferences(),
  upsertMonthlyGoal: (...args: unknown[]) => upsertMonthlyGoal(...args),
}));

describe('GoalSettings', () => {
  it('shows the currently saved goal once loaded', async () => {
    getUserPreferences.mockResolvedValue({ user_id: 'u1', monthly_application_goal: 20 });
    renderWithProviders(<GoalSettings />);

    // findByDisplayValue, not findByLabelText — the input exists (disabled)
    // on the very first render, before the mocked fetch resolves, so a
    // label-based query would resolve before the loaded value ever syncs in.
    expect(await screen.findByDisplayValue('20')).toBeInTheDocument();
  });

  it('saves a new goal on submit', async () => {
    getUserPreferences.mockResolvedValue({ user_id: 'u1', monthly_application_goal: null });
    upsertMonthlyGoal.mockResolvedValue({ user_id: 'u1', monthly_application_goal: 15 });
    const user = userEvent.setup();

    renderWithProviders(<GoalSettings />);

    const input = await screen.findByLabelText(/monthly application goal/i);
    await waitFor(() => expect(input).not.toBeDisabled());
    await user.type(input, '15');
    await user.click(screen.getByRole('button', { name: /save/i }));

    // Not toHaveBeenCalledWith(15) — TanStack Query's mutationFn also
    // receives a second (mutation-context) argument this app never uses.
    await waitFor(() => expect(upsertMonthlyGoal.mock.calls[0]?.[0]).toBe(15));
  });

  it('clears the goal when the field is submitted empty', async () => {
    getUserPreferences.mockResolvedValue({ user_id: 'u1', monthly_application_goal: 20 });
    upsertMonthlyGoal.mockResolvedValue({ user_id: 'u1', monthly_application_goal: null });
    const user = userEvent.setup();

    renderWithProviders(<GoalSettings />);

    const input = await screen.findByDisplayValue('20');
    await user.clear(input);
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(upsertMonthlyGoal.mock.calls[0]?.[0]).toBe(null));
  });

  it('rejects a non-numeric or zero goal without saving', async () => {
    getUserPreferences.mockResolvedValue({ user_id: 'u1', monthly_application_goal: null });
    const user = userEvent.setup();

    renderWithProviders(<GoalSettings />);

    const input = await screen.findByLabelText(/monthly application goal/i);
    await waitFor(() => expect(input).not.toBeDisabled());
    await user.type(input, '0');
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByText(/must be a whole number greater than 0/i)).toBeInTheDocument();
    expect(upsertMonthlyGoal).not.toHaveBeenCalled();
  });
});
