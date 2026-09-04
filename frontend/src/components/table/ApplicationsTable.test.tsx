import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/renderWithProviders';
import type { Application } from '../../services/applicationsService';
import { ApplicationsTable } from './ApplicationsTable';

const applications = [
  {
    id: 'app-1',
    company_name: 'Acme Corporation',
    job_title: 'Backend Developer',
    status: 'pending_application',
    platform_source: 'linkedin',
    location: '',
    work_setup: null,
    applied_date: null,
    salary_range: '',
  },
  {
    id: 'app-2',
    company_name: 'Beta Inc',
    job_title: 'Frontend Developer',
    status: 'interviewed',
    platform_source: 'indeed',
    location: '',
    work_setup: null,
    applied_date: null,
    salary_range: '',
  },
] as unknown as Application[];

describe('ApplicationsTable sorting', () => {
  it('requests ascending sort on the clicked column when it was not already the active sort', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();

    renderWithProviders(
      <ApplicationsTable
        applications={applications}
        isLoading={false}
        sort={{ field: 'created_at', direction: 'desc' }}
        onSortChange={onSortChange}
        onRowClick={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onStatusChange={vi.fn()}
        selectedIds={[]}
        onToggleSelect={vi.fn()}
        onToggleSelectAll={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /company/i }));
    expect(onSortChange).toHaveBeenCalledWith({ field: 'company_name', direction: 'asc' });
  });

  it('flips to descending when the clicked column is already the active ascending sort', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();

    renderWithProviders(
      <ApplicationsTable
        applications={applications}
        isLoading={false}
        sort={{ field: 'company_name', direction: 'asc' }}
        onSortChange={onSortChange}
        onRowClick={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onStatusChange={vi.fn()}
        selectedIds={[]}
        onToggleSelect={vi.fn()}
        onToggleSelectAll={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /company/i }));
    expect(onSortChange).toHaveBeenCalledWith({ field: 'company_name', direction: 'desc' });
  });
});
