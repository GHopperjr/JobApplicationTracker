import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/renderWithProviders';
import { ProfileSection } from './ProfileSection';

const getUserPreferences = vi.fn();
const upsertUserPreferences = vi.fn();
vi.mock('../../services/userPreferencesService', () => ({
  getUserPreferences: () => getUserPreferences(),
  upsertUserPreferences: (...args: unknown[]) => upsertUserPreferences(...args),
}));

describe('ProfileSection', () => {
  it('shows the currently saved graduation date once loaded', async () => {
    getUserPreferences.mockResolvedValue({ user_id: 'u1', graduation_date: '2025-03-15' });
    renderWithProviders(<ProfileSection />);

    expect(await screen.findByDisplayValue('2025-03-15')).toBeInTheDocument();
  });

  it('renders no derived stage when no date is set', async () => {
    getUserPreferences.mockResolvedValue({ user_id: 'u1', graduation_date: null });
    renderWithProviders(<ProfileSection />);

    await screen.findByLabelText(/graduation date/i);
    expect(screen.queryByText(/currently:/i)).not.toBeInTheDocument();
  });

  it('previews the derived stage as the date changes, before saving', async () => {
    getUserPreferences.mockResolvedValue({ user_id: 'u1', graduation_date: null });
    renderWithProviders(<ProfileSection />);

    const input = await screen.findByLabelText(/graduation date/i);
    await waitFor(() => expect(input).not.toBeDisabled());
    fireEvent.change(input, { target: { value: '2020-01-01' } });

    expect(await screen.findByText(/currently: experienced/i)).toBeInTheDocument();
  });

  it('saves the entered date on submit', async () => {
    getUserPreferences.mockResolvedValue({ user_id: 'u1', graduation_date: null });
    upsertUserPreferences.mockResolvedValue({ user_id: 'u1', graduation_date: '2025-03-15' });
    const user = userEvent.setup();
    renderWithProviders(<ProfileSection />);

    const input = await screen.findByLabelText(/graduation date/i);
    await waitFor(() => expect(input).not.toBeDisabled());
    fireEvent.change(input, { target: { value: '2025-03-15' } });
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() =>
      expect(upsertUserPreferences.mock.calls[0]?.[0]).toEqual({
        graduation_date: '2025-03-15',
      })
    );
  });

  it('clears the date when the field is submitted empty', async () => {
    getUserPreferences.mockResolvedValue({ user_id: 'u1', graduation_date: '2025-03-15' });
    upsertUserPreferences.mockResolvedValue({ user_id: 'u1', graduation_date: null });
    const user = userEvent.setup();
    renderWithProviders(<ProfileSection />);

    const input = await screen.findByDisplayValue('2025-03-15');
    fireEvent.change(input, { target: { value: '' } });
    await user.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() =>
      expect(upsertUserPreferences.mock.calls[0]?.[0]).toEqual({ graduation_date: null })
    );
  });
});
