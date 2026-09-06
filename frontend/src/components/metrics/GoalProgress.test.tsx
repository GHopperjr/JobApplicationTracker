import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { GoalProgress } from './GoalProgress';

describe('GoalProgress', () => {
  it('renders nothing outside This Month', () => {
    const { container } = render(
      <MemoryRouter>
        <GoalProgress period="last30" count={5} goal={20} />
      </MemoryRouter>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the "set a goal" prompt when no goal is set', () => {
    render(
      <MemoryRouter>
        <GoalProgress period="month" count={5} goal={null} />
      </MemoryRouter>
    );
    expect(screen.getByRole('link', { name: /set a monthly goal/i })).toBeInTheDocument();
  });

  it('renders the progress bar with the real count and goal when one is set', () => {
    render(
      <MemoryRouter>
        <GoalProgress period="month" count={5} goal={20} />
      </MemoryRouter>
    );
    expect(screen.getByText('5 of 20 applications this month')).toBeInTheDocument();
  });

  it('does not cap the displayed numbers when the count exceeds the goal', () => {
    render(
      <MemoryRouter>
        <GoalProgress period="month" count={24} goal={20} />
      </MemoryRouter>
    );
    expect(screen.getByText('24 of 20 applications this month')).toBeInTheDocument();
  });
});
