import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { useApplicationFilters } from './useApplicationFilters';

function wrapper(route: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>;
  };
}

describe('useApplicationFilters', () => {
  it('drops a hand-edited, invalid status value instead of passing it through', () => {
    // Validated, not cast — a bogus ?status= would otherwise reach
    // `.in('status', [...])` and return Postgres 22P02 (docs/08 non-negotiable #6).
    const { result } = renderHook(() => useApplicationFilters(), {
      wrapper: wrapper('/applications?status=bogus&status=interviewed'),
    });

    expect(result.current.filters.status).toEqual(['interviewed']);
  });

  it('drops an invalid sort field and falls back to the default', () => {
    const { result } = renderHook(() => useApplicationFilters(), {
      wrapper: wrapper('/applications?sort=not_a_column&dir=asc'),
    });

    expect(result.current.sort).toEqual({ field: 'created_at', direction: 'asc' });
  });

  it('round-trips valid status and platform values from the URL', () => {
    const { result } = renderHook(() => useApplicationFilters(), {
      wrapper: wrapper('/applications?status=interviewed&platform=linkedin&q=acme'),
    });

    expect(result.current.filters).toEqual({
      status: ['interviewed'],
      platform: ['linkedin'],
      search: 'acme',
      archived: 'active',
    });
  });

  it('drops a hand-edited, invalid archived value and falls back to active', () => {
    const { result } = renderHook(() => useApplicationFilters(), {
      wrapper: wrapper('/applications?archived=bogus'),
    });

    expect(result.current.filters.archived).toBe('active');
  });

  it('round-trips a valid archived scope from the URL', () => {
    const { result } = renderHook(() => useApplicationFilters(), {
      wrapper: wrapper('/applications?archived=archived'),
    });

    expect(result.current.filters.archived).toBe('archived');
  });

  it('reads the stale flag from the URL, defaulting to false', () => {
    const { result: withoutFlag } = renderHook(() => useApplicationFilters(), {
      wrapper: wrapper('/applications'),
    });
    expect(withoutFlag.current.stale).toBe(false);

    const { result: withFlag } = renderHook(() => useApplicationFilters(), {
      wrapper: wrapper('/applications?stale=1'),
    });
    expect(withFlag.current.stale).toBe(true);
  });
});
