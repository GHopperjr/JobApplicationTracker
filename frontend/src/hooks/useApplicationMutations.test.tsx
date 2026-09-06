import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { queryKeys } from './queryKeys';
import { useApplicationMutations } from './useApplicationMutations';
import type { Application } from '../services/applicationsService';

vi.mock('../services/applicationsService', async () => {
  const actual = await vi.importActual<typeof import('../services/applicationsService')>(
    '../services/applicationsService'
  );
  return { ...actual, updateApplicationStatus: vi.fn(), bulkUpdateStatus: vi.fn() };
});

import { bulkUpdateStatus, updateApplicationStatus } from '../services/applicationsService';

const mockApp = { id: 'app-1', status: 'pending_application' } as Application;

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useApplicationMutations changeStatus', () => {
  it('rolls back the optimistic update when the mutation rejects', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const listKey = queryKeys.applications.list({}, { field: 'created_at', direction: 'desc' });
    queryClient.setQueryData(listKey, [mockApp]);

    // A manually-controlled rejection, so the test can observe the
    // optimistic state before the rollback fires instead of racing it.
    let rejectMutation!: (err: Error) => void;
    vi.mocked(updateApplicationStatus).mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectMutation = reject;
      })
    );
    const onStatusError = vi.fn();

    const { result } = renderHook(() => useApplicationMutations({ onStatusError }), {
      wrapper: makeWrapper(queryClient),
    });

    act(() => {
      result.current.changeStatus.mutate({ id: 'app-1', status: 'interviewed' });
    });

    // Optimistic update applies immediately, before the mutation settles.
    await waitFor(() => {
      expect(queryClient.getQueryData<Application[]>(listKey)?.[0].status).toBe('interviewed');
    });

    act(() => {
      rejectMutation(new Error('network error'));
    });

    // Then rolls back once the mutation actually rejects.
    await waitFor(() => {
      expect(queryClient.getQueryData<Application[]>(listKey)?.[0].status).toBe(
        'pending_application'
      );
    });
    expect(onStatusError).toHaveBeenCalled();
  });

  it('does not throw when a detail query is cached alongside the list', async () => {
    // Regression test for the queryKeys.applications.all vs .lists bug: `all`
    // prefix-matches `detail(id)` too, and detail is a single object, not an
    // array — an updater written against `all` throws inside onMutate before
    // the mutation ever fires (docs/03-frontend-architecture.md).
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const listKey = queryKeys.applications.list({}, { field: 'created_at', direction: 'desc' });
    queryClient.setQueryData(listKey, [mockApp]);
    queryClient.setQueryData(queryKeys.applications.detail('app-1'), mockApp);

    vi.mocked(updateApplicationStatus).mockResolvedValue({
      ...mockApp,
      status: 'interviewed',
    } as Application);

    const { result } = renderHook(() => useApplicationMutations(), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      await result.current.changeStatus.mutateAsync({ id: 'app-1', status: 'interviewed' });
    });

    expect(queryClient.getQueryData<Application[]>(listKey)?.[0].status).toBe('interviewed');
  });

  it('optimistically applies interviewScheduledAt when the guard supplies one', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const listKey = queryKeys.applications.list({}, { field: 'created_at', direction: 'desc' });
    queryClient.setQueryData(listKey, [mockApp]);
    vi.mocked(updateApplicationStatus).mockReturnValue(new Promise(() => {})); // never resolves

    const { result } = renderHook(() => useApplicationMutations(), {
      wrapper: makeWrapper(queryClient),
    });

    act(() => {
      result.current.changeStatus.mutate({
        id: 'app-1',
        status: 'scheduled_for_interview',
        interviewScheduledAt: '2026-09-10T06:30:00.000Z',
      });
    });

    await waitFor(() => {
      expect(queryClient.getQueryData<Application[]>(listKey)?.[0]).toMatchObject({
        status: 'scheduled_for_interview',
        interview_scheduled_at: '2026-09-10T06:30:00.000Z',
      });
    });
  });
});

describe('useApplicationMutations bulkStatus', () => {
  it('rolls back every selected row as one unit when the mutation rejects', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const listKey = queryKeys.applications.list({}, { field: 'created_at', direction: 'desc' });
    const appA = { id: 'app-1', status: 'pending_application' } as Application;
    const appB = { id: 'app-2', status: 'pending_application' } as Application;
    queryClient.setQueryData(listKey, [appA, appB]);

    let rejectMutation!: (err: Error) => void;
    vi.mocked(bulkUpdateStatus).mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectMutation = reject;
      })
    );

    const { result } = renderHook(() => useApplicationMutations(), {
      wrapper: makeWrapper(queryClient),
    });

    act(() => {
      result.current.bulkStatus.mutate({ ids: ['app-1', 'app-2'], status: 'interviewed' });
    });

    await waitFor(() => {
      const rows = queryClient.getQueryData<Application[]>(listKey);
      expect(rows?.every((r) => r.status === 'interviewed')).toBe(true);
    });

    act(() => {
      rejectMutation(new Error('network error'));
    });

    await waitFor(() => {
      const rows = queryClient.getQueryData<Application[]>(listKey);
      expect(rows?.every((r) => r.status === 'pending_application')).toBe(true);
    });
  });
});
