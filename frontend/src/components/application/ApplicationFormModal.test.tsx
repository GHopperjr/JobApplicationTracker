import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/renderWithProviders';
import { ApplicationFormModal } from './ApplicationFormModal';

describe('ApplicationFormModal', () => {
  it('surfaces validation errors and blocks submit when required fields are blank', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ApplicationFormModal isOpen onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /add application/i }));

    expect(await screen.findByText(/company name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/job title is required/i)).toBeInTheDocument();
  });
});
