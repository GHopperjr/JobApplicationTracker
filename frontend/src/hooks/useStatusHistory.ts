import { useQuery } from '@tanstack/react-query';
import { listForApplication } from '../services/statusHistoryService';
import { queryKeys } from './queryKeys';

export function useStatusHistory(applicationId: string) {
  const query = useQuery({
    queryKey: queryKeys.applications.history(applicationId),
    queryFn: () => listForApplication(applicationId),
    enabled: Boolean(applicationId),
    staleTime: 60_000, // history only changes when status changes
  });

  return {
    history: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
