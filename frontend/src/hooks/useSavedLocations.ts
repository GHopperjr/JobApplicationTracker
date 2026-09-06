import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Coordinates } from '../lib/distance';
import {
  createSavedLocation,
  deleteSavedLocation,
  listSavedLocations,
  setDefaultSavedLocation,
  updateSavedLocation,
} from '../services/savedLocationsService';
import { queryKeys } from './queryKeys';

type SavedLocationPatch = { label?: string; address?: string; coordinates?: Coordinates };

export function useSavedLocations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.savedLocations.all });

  const query = useQuery({
    queryKey: queryKeys.savedLocations.all,
    queryFn: listSavedLocations,
  });

  const create = useMutation({ mutationFn: createSavedLocation, onSuccess: invalidate });

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: SavedLocationPatch }) =>
      updateSavedLocation(id, patch),
    onSuccess: invalidate,
  });

  const remove = useMutation({ mutationFn: deleteSavedLocation, onSuccess: invalidate });

  const setDefault = useMutation({ mutationFn: setDefaultSavedLocation, onSuccess: invalidate });

  return {
    locations: query.data ?? [],
    isLoading: query.isLoading,
    create,
    update,
    remove,
    setDefault,
  };
}
