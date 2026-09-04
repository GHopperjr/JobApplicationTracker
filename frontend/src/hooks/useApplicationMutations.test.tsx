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
  return { ...actual, updateApplicationStatus: vi.fn() };
});

import { updateApplicationStatus } from '../services/applicationsService';

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
});
