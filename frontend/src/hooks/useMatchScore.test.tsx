import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Application } from '../services/applicationsService';
import { useMatchScore } from './useMatchScore';

const getUserPreferences = vi.fn();
vi.mock('../services/userPreferencesService', () => ({
  getUserPreferences: () => getUserPreferences(),
}));

const calculateMatch = vi.fn();
vi.mock('../services/matchService', () => ({
  calculateMatch: (...args: unknown[]) => calculateMatch(...args),
}));

const updateApplication = vi.fn();
vi.mock('../services/applicationsService', async () => {
  const actual = await vi.importActual<typeof import('../services/applicationsService')>(
    '../services/applicationsService'
  );
  return { ...actual, updateApplication: (...args: unknown[]) => updateApplication(...args) };
});

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const application = (overrides: Partial<Application> = {}) =>
  ({
    id: 'app-1',
    job_description: 'a real job description',
    match_percentage: null,
    match_explanation: null,
    match_calculated_at: null,
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }) as Application;

describe('useMatchScore', () => {
  it('cannot calculate without both a resume and a job description', () => {
    getUserPreferences.mockResolvedValue({ resume_text: null, resume_uploaded_at: null });
    const { result } = renderHook(() => useMatchScore(application({ job_description: null })), {
      wrapper,
    });
    expect(result.current.canCalculate).toBe(false);
  });

  it('writes the result back to the application on success', async () => {
    getUserPreferences.mockResolvedValue({ resume_text: 'resume text', resume_uploaded_at: null });
    calculateMatch.mockResolvedValue({ percentage: 88, explanation: 'Great fit' });
    updateApplication.mockResolvedValue({});

    const { result } = renderHook(() => useMatchScore(application()), { wrapper });
    await waitFor(() => expect(result.current.canCalculate).toBe(true));

    await act(async () => {
      await result.current.calculate();
    });

    expect(updateApplication).toHaveBeenCalledWith(
      'app-1',
      expect.objectContaining({ match_percentage: 88, match_explanation: 'Great fit' })
    );
  });

  it('never writes to the application when the match calculation fails — the non-negotiable', async () => {
    getUserPreferences.mockResolvedValue({ resume_text: 'resume text', resume_uploaded_at: null });
    calculateMatch.mockResolvedValue(null); // matchService's own "failed" contract

    const cachedApplication = application({
      match_percentage: 70,
      match_explanation: 'Previously cached result',
      match_calculated_at: '2025-12-01T00:00:00.000Z',
    });
    const { result } = renderHook(() => useMatchScore(cachedApplication), { wrapper });
    await waitFor(() => expect(result.current.canCalculate).toBe(true));

    await act(async () => {
      await expect(result.current.calculate()).rejects.toThrow();
    });

    expect(updateApplication).not.toHaveBeenCalled();
    // The hook's own view of the cached result is read straight from the
    // application prop, so it's untouched by construction — asserting it
    // here documents the guarantee, not just infers it.
    expect(result.current.percentage).toBe(70);
    expect(result.current.explanation).toBe('Previously cached result');
    await waitFor(() => expect(result.current.failed).toBe(true));
  });
});
