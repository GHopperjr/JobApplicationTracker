import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isMatchStale } from '../lib/matchStaleness';
import { calculateMatch } from '../services/matchService';
import { getUserPreferences } from '../services/userPreferencesService';
import { updateApplication, type Application } from '../services/applicationsService';
import { queryKeys } from './queryKeys';

/**
 * Triggers a match calculation for one application and writes the cached
 * result back through the existing applications service — never automatic,
 * always a result of the user clicking a button
 * (docs/14-ai-match-scoring.md). A failed calculation only ever surfaces
 * through `failed`; it never writes anything, so a previously cached
 * result on `application` is left completely untouched.
 */
export function useMatchScore(application: Application) {
  const queryClient = useQueryClient();

  const preferences = useQuery({
    queryKey: queryKeys.userPreferences.all,
    queryFn: getUserPreferences,
  });
  const resumeText = preferences.data?.resume_text ?? null;
  const resumeUploadedAt = preferences.data?.resume_uploaded_at ?? null;

  const canCalculate = Boolean(resumeText && application.job_description);
  const isStale = isMatchStale(
    application.match_calculated_at,
    resumeUploadedAt,
    application.updated_at
  );

  const mutation = useMutation({
    mutationFn: async () => {
      const result = await calculateMatch(resumeText!, application.job_description!);
      if (!result) throw new Error('Match calculation failed');
      return updateApplication(application.id, {
        match_percentage: result.percentage,
        match_explanation: result.explanation,
        match_calculated_at: new Date().toISOString(),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.applications.all }),
  });

  return {
    canCalculate,
    isStale,
    hasResult: application.match_percentage !== null,
    percentage: application.match_percentage,
    explanation: application.match_explanation,
    calculate: mutation.mutateAsync,
    isCalculating: mutation.isPending,
    failed: mutation.isError,
    resetFailed: mutation.reset,
  };
}
