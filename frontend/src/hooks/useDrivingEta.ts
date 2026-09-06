import { useQuery } from '@tanstack/react-query';
import type { Coordinates } from '../lib/distance';
import { getDrivingRoute } from '../services/routingService';

/**
 * The real driving route (duration + road distance) between a saved
 * location and an application's location, computed live and only while the
 * drawer is open. Deliberately not stored and not cached beyond this
 * query's own lifetime: it depends on a *pair* (which saved location ×
 * which application), so caching it means caching N×M values and
 * invalidating them whenever either side moves — for a number that costs
 * nothing to recompute (docs/11-navigation-and-distance.md).
 *
 * `enabled` on both coordinate pairs existing, so the common case (a remote
 * role, or no saved location yet) makes no request at all.
 */
export function useDrivingEta(from: Coordinates | null, to: Coordinates | null) {
  return useQuery({
    queryKey: ['driving-eta', from, to],
    queryFn: () => getDrivingRoute(from!, to!),
    enabled: Boolean(from && to),
    gcTime: 0,
  });
}
