import { describe, expect, it } from 'vitest';
import App from './App';
import { renderWithProviders } from './test/renderWithProviders';

describe('App', () => {
  it('renders the login page when signed out', async () => {
    const { findByLabelText } = renderWithProviders(<App />, { route: '/login' });
    expect(await findByLabelText(/email/i)).toBeInTheDocument();
  });
});
