import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAuth } from './useAuth';
import { queryKeys } from './queryKeys';
import { subscribeToApplications } from '../services/realtimeService';

export function useRealtimeApplications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;
    return subscribeToApplications(user.id, () => {
      // Invalidate, never hand-patch. A realtime event racing an in-flight
      // optimistic update writing to the same cache from two directions is
      // how ghost cards and duplicated rows happen.
      queryClient.invalidateQueries({ queryKey: queryKeys.applications.all });
    });
  }, [user, queryClient]);
}
