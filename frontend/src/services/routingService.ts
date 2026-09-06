import type { Coordinates } from '../lib/distance';

const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1/driving';

export type DrivingRoute = {
  durationSeconds: number;
  /** The real road-network distance, in metres — distinct from
   * `haversineKm`'s straight-line figure, and usually longer than it
   * (docs/11-navigation-and-distance.md). */
  distanceMeters: number;
};

/**
 * The driving route between two points via OSRM's public demo server. Like
 * geocodingService, returns `null` rather than throwing on any failure — the
 * drawer still shows the straight-line kilometre distance either way; only
 * the road-distance and "~N min by car" clauses are omitted
 * (docs/11-navigation-and-distance.md).
 *
 * **This is a free-flow estimate, not a live-traffic-aware one.** OSRM
 * has no live congestion feed and no knowledge of recent road closures —
 * verified live on a real Cavite route where it returned 7 minutes for a
 * road distance Google's live-traffic routing (accounting for an actual
 * closure) put at 18–19 minutes. The road *distance* it returns is
 * reliable (real road-network routing); the *duration* is a best-case
 * lower bound, not a prediction.
 *
 * OSRM takes `lng,lat` — the reverse of every other API in this feature and
 * the reverse of how coordinates are stored. The flip happens here, in
 * exactly one place, so no call site can get it wrong.
 */
export async function getDrivingRoute(
  from: Coordinates,
  to: Coordinates
): Promise<DrivingRoute | null> {
  try {
    const url = `${OSRM_BASE_URL}/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=false`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = (await response.json()) as {
      routes?: { duration: number; distance: number }[];
    };
    const route = data.routes?.[0];
    if (!route || typeof route.duration !== 'number' || typeof route.distance !== 'number') {
      return null;
    }
    return { durationSeconds: route.duration, distanceMeters: route.distance };
  } catch {
    return null;
  }
}
