import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getUserPreferences, upsertMonthlyGoal } from '../services/userPreferencesService';
import { queryKeys } from './queryKeys';

/** Read/upsert the monthly application goal (docs/12-interview-metrics.md). */
export function useUserPreferences() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.userPreferences.all,
    queryFn: getUserPreferences,
  });

  const mutation = useMutation({
    mutationFn: upsertMonthlyGoal,
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.userPreferences.all, data);
    },
  });

  return {
    goal: query.data?.monthly_application_goal ?? null,
    isLoading: query.isLoading,
    setGoal: mutation.mutateAsync,
    isSaving: mutation.isPending,
  };
}
