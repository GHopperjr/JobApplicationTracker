import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteResume, uploadResume } from '../services/resumeService';
import { getUserPreferences } from '../services/userPreferencesService';
import { useAuth } from './useAuth';
import { queryKeys } from './queryKeys';

/**
 * Read/upload/remove the one stored resume (docs/14-ai-match-scoring.md).
 * Shares `queryKeys.userPreferences.all` with useUserPreferences — it's the
 * same row, just a different slice of it, so a resume upload and a goal
 * edit invalidate/refresh the same cache entry rather than two.
 */
export function useResume() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.userPreferences.all,
    queryFn: getUserPreferences,
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadResume(user!.id, file),
    onSuccess: (data) => queryClient.setQueryData(queryKeys.userPreferences.all, data),
  });

  const removeMutation = useMutation({
    mutationFn: () => deleteResume(query.data!.resume_storage_path!),
    onSuccess: (data) => queryClient.setQueryData(queryKeys.userPreferences.all, data),
  });

  return {
    filename: query.data?.resume_filename ?? null,
    uploadedAt: query.data?.resume_uploaded_at ?? null,
    hasResume: Boolean(query.data?.resume_text),
    isLoading: query.isLoading,
    upload: uploadMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
    remove: removeMutation.mutateAsync,
    isRemoving: removeMutation.isPending,
  };
}
