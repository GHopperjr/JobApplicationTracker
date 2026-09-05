import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../test/renderWithProviders';
import { LoginPage } from './LoginPage';

describe('LoginPage', () => {
  it('shows validation errors and does not submit when fields are invalid', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { route: '/login' });

    const form = within(screen.getByTestId('credentials-form'));
    await user.type(screen.getByLabelText(/email/i), 'not-an-email');
    await user.type(screen.getByLabelText(/password/i), 'short');
    await user.click(form.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/enter a valid email address/i)).toBeInTheDocument();
    expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
  });

  it('toggles between sign-in and sign-up copy via the mode toggle', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { route: '/login' });

    const toggle = within(screen.getByRole('group', { name: /sign in or create an account/i }));
    expect(screen.getByText(/sign in to your account/i)).toBeInTheDocument();

    await user.click(toggle.getByRole('button', { name: /^sign up$/i }));

    await waitFor(() => {
      expect(screen.getByText(/create an account to get started/i)).toBeInTheDocument();
    });
    const form = within(screen.getByTestId('credentials-form'));
    expect(form.getByRole('button', { name: /^sign up$/i })).toBeInTheDocument();
  });
});
