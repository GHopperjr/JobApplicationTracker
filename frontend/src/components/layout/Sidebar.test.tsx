import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../test/renderWithProviders';
import { Sidebar } from './Sidebar';

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  localStorage.clear();
});

describe('Sidebar', () => {
  it('renders expanded with full labels and an icon per item by default', () => {
    renderWithProviders(<Sidebar />);

    expect(screen.getByText('Job Tracker')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Job Applications' });
    expect(link).toBeInTheDocument();
    expect(link.querySelector('svg')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
  });

  it('collapses to icon-only nav items on toggle, and back on toggle again', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Sidebar />);

    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));

    expect(screen.queryByText('Job Tracker')).not.toBeInTheDocument();
    // The label survives for assistive tech even while hidden visually, and
    // the icon stays visible — it's the only thing left once the label hides.
    const collapsedLink = screen.getByRole('link', { name: 'Job Applications' });
    expect(collapsedLink.querySelector('svg')).toBeInTheDocument();
    expect(screen.getByText('Job Applications')).toHaveClass('sr-only');
    const expandButton = screen.getByRole('button', { name: 'Expand sidebar' });
    expect(expandButton).toBeInTheDocument();

    await user.click(expandButton);

    expect(screen.getByText('Job Tracker')).toBeInTheDocument();
    expect(screen.getByText('Job Applications')).not.toHaveClass('sr-only');
  });

  it('persists the collapsed preference across remounts', async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithProviders(<Sidebar />);

    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    unmount();

    renderWithProviders(<Sidebar />);

    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
  });
});
