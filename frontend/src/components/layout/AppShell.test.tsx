import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../../hooks/queryKeys';
import { renderWithProviders } from '../../test/renderWithProviders';
import { AppShell } from './AppShell';

const mockSignOut = vi.fn().mockResolvedValue(undefined);

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { email: 'test@example.com' },
    session: {},
    isLoading: false,
    sessionExpired: false,
    clearSessionExpired: vi.fn(),
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: mockSignOut,
  }),
}));

describe('AppShell sign out', () => {
  it('clears the query cache after sign-out resolves', async () => {
    const user = userEvent.setup();
    const { queryClient } = renderWithProviders(
      <Routes>
        <Route path="/applications" element={<AppShell />}>
          <Route index element={<div>Page content</div>} />
        </Route>
      </Routes>,
      { route: '/applications' }
    );

    // A cross-user leak guard (docs/05 F1): a previous user's cached
    // applications must not survive into the next signed-in session.
    queryClient.setQueryData(queryKeys.applications.all, [{ id: 'stale-application' }]);

    await user.click(screen.getByRole('button', { name: 'test@example.com' }));
    await user.click(await screen.findByRole('menuitem', { name: /sign out/i }));

    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
    await waitFor(() => {
      expect(queryClient.getQueryData(queryKeys.applications.all)).toBeUndefined();
    });
  });
});
