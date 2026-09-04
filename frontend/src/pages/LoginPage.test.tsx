import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import { LoginPage } from './LoginPage';

describe('LoginPage', () => {
  it('shows validation errors and does not submit when fields are invalid', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { route: '/login' });

    await user.type(screen.getByLabelText(/email/i), 'not-an-email');
    await user.type(screen.getByLabelText(/password/i), 'short');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/enter a valid email address/i)).toBeInTheDocument();
    expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
  });

  it('toggles between sign-in and sign-up copy', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { route: '/login' });

    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /don't have an account/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^sign up$/i })).toBeInTheDocument();
    });
  });
});
