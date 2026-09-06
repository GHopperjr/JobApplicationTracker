import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { useApplicationFilters } from './useApplicationFilters';

const getUserPreferences = vi.fn();
vi.mock('../services/userPreferencesService', () => ({
  getUserPreferences: () => getUserPreferences(),
  upsertUserPreferences: vi.fn(),
}));

function wrapper(route: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

describe('useApplicationFilters', () => {
  it('drops a hand-edited, invalid status value instead of passing it through', () => {
    getUserPreferences.mockResolvedValue(null);
    // Validated, not cast — a bogus ?status= would otherwise reach
    // `.in('status', [...])` and return Postgres 22P02 (docs/08 non-negotiable #6).
    const { result } = renderHook(() => useApplicationFilters(), {
      wrapper: wrapper('/applications?status=bogus&status=interviewed'),
    });

    expect(result.current.filters.status).toEqual(['interviewed']);
  });

  it('drops an invalid sort field and falls back to the default', () => {
    getUserPreferences.mockResolvedValue(null);
    const { result } = renderHook(() => useApplicationFilters(), {
      wrapper: wrapper('/applications?sort=not_a_column&dir=asc'),
    });

    expect(result.current.sort).toEqual({ field: 'created_at', direction: 'asc' });
  });

  it('round-trips valid status and platform values from the URL', () => {
    getUserPreferences.mockResolvedValue(null);
    const { result } = renderHook(() => useApplicationFilters(), {
      wrapper: wrapper('/applications?status=interviewed&platform=linkedin&q=acme'),
    });

    expect(result.current.filters).toEqual({
      status: ['interviewed'],
      platform: ['linkedin'],
      search: 'acme',
      archived: 'active',
      audience: [],
    });
  });

  it('drops a hand-edited, invalid archived value and falls back to active', () => {
    getUserPreferences.mockResolvedValue(null);
    const { result } = renderHook(() => useApplicationFilters(), {
      wrapper: wrapper('/applications?archived=bogus'),
    });

    expect(result.current.filters.archived).toBe('active');
  });

  it('round-trips a valid archived scope from the URL', () => {
    getUserPreferences.mockResolvedValue(null);
    const { result } = renderHook(() => useApplicationFilters(), {
      wrapper: wrapper('/applications?archived=archived'),
    });

    expect(result.current.filters.archived).toBe('archived');
  });

  it('reads the stale flag from the URL, defaulting to false', () => {
    getUserPreferences.mockResolvedValue(null);
    const { result: withoutFlag } = renderHook(() => useApplicationFilters(), {
      wrapper: wrapper('/applications'),
    });
    expect(withoutFlag.current.stale).toBe(false);

    const { result: withFlag } = renderHook(() => useApplicationFilters(), {
      wrapper: wrapper('/applications?stale=1'),
    });
    expect(withFlag.current.stale).toBe(true);
  });

  describe('audience (docs/13-profile-and-experience-filtering.md)', () => {
    it('shows everything when no audience parameter and no graduation date is set', () => {
      getUserPreferences.mockResolvedValue(null);
      const { result } = renderHook(() => useApplicationFilters(), {
        wrapper: wrapper('/applications'),
      });

      expect(result.current.filters.audience).toEqual([]);
    });

    it('applies the profile-derived default when no audience parameter is present', async () => {
      getUserPreferences.mockResolvedValue({ user_id: 'u1', graduation_date: '2020-01-01' });
      const { result } = renderHook(() => useApplicationFilters(), {
        wrapper: wrapper('/applications'),
      });

      // The preferences query resolves asynchronously — the default only
      // applies once it has.
      await waitFor(() =>
        expect(result.current.filters.audience).toEqual(['experienced', 'unspecified'])
      );
    });

    it('shows everything for the explicit all sentinel, regardless of the profile', async () => {
      getUserPreferences.mockResolvedValue({ user_id: 'u1', graduation_date: '2020-01-01' });
      const { result } = renderHook(() => useApplicationFilters(), {
        wrapper: wrapper('/applications?audience=all'),
      });

      await waitFor(() => expect(getUserPreferences).toHaveBeenCalled());
      expect(result.current.filters.audience).toEqual([]);
    });

    it('round-trips an explicit audience selection from the URL', () => {
      getUserPreferences.mockResolvedValue(null);
      const { result } = renderHook(() => useApplicationFilters(), {
        wrapper: wrapper('/applications?audience=fresh_grad&audience=unspecified'),
      });

      expect(result.current.filters.audience).toEqual(['fresh_grad', 'unspecified']);
    });

    it('drops a hand-edited, invalid audience value instead of passing it through', () => {
      getUserPreferences.mockResolvedValue(null);
      const { result } = renderHook(() => useApplicationFilters(), {
        wrapper: wrapper('/applications?audience=bogus&audience=fresh_grad'),
      });

      expect(result.current.filters.audience).toEqual(['fresh_grad']);
    });

    it('keeps the selection cleared rather than springing back to the derived default', async () => {
      // Only meaningful with a profile set — with none, "absent parameter"
      // and "explicitly cleared" both already read as [], so a bug that
      // wrote nothing instead of the `all` sentinel would pass by accident.
      getUserPreferences.mockResolvedValue({ user_id: 'u1', graduation_date: '2020-01-01' });
      const { result } = renderHook(() => useApplicationFilters(), {
        wrapper: wrapper('/applications'),
      });

      await waitFor(() =>
        expect(result.current.filters.audience).toEqual(['experienced', 'unspecified'])
      );

      act(() => {
        result.current.setFilters({ audience: [] });
      });

      expect(result.current.filters.audience).toEqual([]);
    });
  });
});
