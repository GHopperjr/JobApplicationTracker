import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Application } from '../../services/applicationsService';
import { renderWithProviders } from '../../test/renderWithProviders';
import { ApplicationCard } from './ApplicationCard';

const mockApplication = {
  id: 'app-1',
  company_name: 'Acme Corporation',
  job_title: 'Backend Developer',
  platform_source: 'linkedin',
  status: 'pending_application',
  salary_range: '',
  applied_date: null,
} as unknown as Application;

describe('ApplicationCard', () => {
  it('renders the application and fires onView when clicked', async () => {
    const user = userEvent.setup();
    const onView = vi.fn();

    renderWithProviders(
      <ApplicationCard application={mockApplication} onView={onView} onEdit={vi.fn()} onDelete={vi.fn()} />
    );

    expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    expect(screen.getByText('Backend Developer')).toBeInTheDocument();

    // Clicking anywhere on the card bubbles up to its own onClick — the card
    // itself has no distinct accessible name (its role="button" content
    // includes the actions menu's own label), so target inner text instead.
    await user.click(screen.getByText('Acme Corporation'));
    expect(onView).toHaveBeenCalledWith('app-1');
  });

  it('fires onEdit and onDelete from the actions menu without also opening the card', async () => {
    const user = userEvent.setup();
    const onView = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    renderWithProviders(
      <ApplicationCard application={mockApplication} onView={onView} onEdit={onEdit} onDelete={onDelete} />
    );

    await user.click(screen.getByRole('button', { name: /actions for acme corporation/i }));
    await user.click(await screen.findByRole('menuitem', { name: /edit/i }));

    expect(onEdit).toHaveBeenCalledWith(mockApplication);
    // Clicking the menu is a click on the card too — it must not bubble up
    // and also open the drawer.
    expect(onView).not.toHaveBeenCalled();
  });
});
