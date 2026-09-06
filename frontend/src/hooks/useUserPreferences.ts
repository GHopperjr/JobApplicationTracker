import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getUserPreferences, upsertUserPreferences } from '../services/userPreferencesService';
import { queryKeys } from './queryKeys';

/**
 * Read/upsert the singleton preferences row — the monthly application goal
 * (docs/12-interview-metrics.md) and the graduation date
 * (docs/13-profile-and-experience-filtering.md). One mutation for both,
 * since they're the same upsert against the same row; `setGoal`/
 * `setGraduationDate` are just narrower call shapes over it.
 */
export function useUserPreferences() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.userPreferences.all,
    queryFn: getUserPreferences,
  });

  const mutation = useMutation({
    mutationFn: upsertUserPreferences,
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.userPreferences.all, data);
    },
  });

  return {
    goal: query.data?.monthly_application_goal ?? null,
    graduationDate: query.data?.graduation_date ?? null,
    isLoading: query.isLoading,
    setGoal: (goal: number | null) => mutation.mutateAsync({ monthly_application_goal: goal }),
    setGraduationDate: (graduationDate: string | null) =>
      mutation.mutateAsync({ graduation_date: graduationDate }),
    isSaving: mutation.isPending,
  };
}
