import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Application } from '../../services/applicationsService';
import { renderWithProviders } from '../../test/renderWithProviders';
import { MatchScore } from './MatchScore';

const useMatchScore = vi.fn();
vi.mock('../../hooks/useMatchScore', () => ({
  useMatchScore: (...args: unknown[]) => useMatchScore(...args),
}));

const application = { id: 'app-1' } as Application;

const baseHookReturn = {
  canCalculate: false,
  isStale: false,
  hasResult: false,
  percentage: null,
  explanation: null,
  calculate: vi.fn(),
  isCalculating: false,
  failed: false,
  resetFailed: vi.fn(),
};

describe('MatchScore', () => {
  it('renders nothing when there is no resume/job description and no cached result', () => {
    useMatchScore.mockReturnValue(baseHookReturn);
    const { container } = renderWithProviders(<MatchScore application={application} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the Calculate Match button when both a resume and a job description exist', () => {
    useMatchScore.mockReturnValue({ ...baseHookReturn, canCalculate: true });
    renderWithProviders(<MatchScore application={application} />);
    expect(screen.getByRole('button', { name: 'Calculate Match' })).toBeInTheDocument();
  });

  it('shows the cached percentage and explanation when a result exists', () => {
    useMatchScore.mockReturnValue({
      ...baseHookReturn,
      hasResult: true,
      percentage: 82,
      explanation: 'Strong match on React and TypeScript.',
    });
    renderWithProviders(<MatchScore application={application} />);
    expect(screen.getByText('82%')).toBeInTheDocument();
    expect(screen.getByText('Strong match on React and TypeScript.')).toBeInTheDocument();
  });

  it('shows the stale notice and a Recalculate button only when the result is stale', () => {
    useMatchScore.mockReturnValue({
      ...baseHookReturn,
      canCalculate: true,
      hasResult: true,
      percentage: 60,
      explanation: 'Some overlap.',
      isStale: true,
    });
    renderWithProviders(<MatchScore application={application} />);
    expect(screen.getByText(/updated since this was calculated/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recalculate' })).toBeInTheDocument();
  });

  it('does not show the stale notice or a recalculate button for a fresh result', () => {
    useMatchScore.mockReturnValue({
      ...baseHookReturn,
      canCalculate: true,
      hasResult: true,
      percentage: 60,
      explanation: 'Some overlap.',
      isStale: false,
    });
    renderWithProviders(<MatchScore application={application} />);
    expect(screen.queryByText(/updated since this was calculated/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /recalculate/i })).not.toBeInTheDocument();
  });

  it('shows a failed-call error and leaves a previously cached result visible and unchanged', () => {
    useMatchScore.mockReturnValue({
      ...baseHookReturn,
      canCalculate: true,
      hasResult: true,
      percentage: 75,
      explanation: 'Cached before the failure.',
      failed: true,
    });
    renderWithProviders(<MatchScore application={application} />);

    expect(screen.getByText(/couldn't calculate a match/i)).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('Cached before the failure.')).toBeInTheDocument();
  });

  it('calls calculate when the button is clicked', async () => {
    const calculate = vi.fn().mockResolvedValue(undefined);
    useMatchScore.mockReturnValue({ ...baseHookReturn, canCalculate: true, calculate });
    const user = userEvent.setup();
    renderWithProviders(<MatchScore application={application} />);

    await user.click(screen.getByRole('button', { name: 'Calculate Match' }));

    expect(calculate).toHaveBeenCalled();
  });
});
