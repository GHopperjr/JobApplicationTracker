import type { Coordinates } from '../lib/distance';

const OSRM_BASE_URL = 'https://router.project-osrm.org/route/v1/driving';

/**
 * Driving duration between two points via OSRM's public demo server. Like
 * geocodingService, returns `null` rather than throwing on any failure — the
 * drawer still shows the straight-line kilometre distance either way; only
 * the "~N min by car" clause is omitted (docs/11-navigation-and-distance.md).
 *
 * OSRM takes `lng,lat` — the reverse of every other API in this feature and
 * the reverse of how coordinates are stored. The flip happens here, in
 * exactly one place, so no call site can get it wrong.
 */
export async function getDrivingDurationSeconds(
  from: Coordinates,
  to: Coordinates
): Promise<number | null> {
  try {
    const url = `${OSRM_BASE_URL}/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=false`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = (await response.json()) as { routes?: { duration: number }[] };
    const duration = data.routes?.[0]?.duration;
    return typeof duration === 'number' ? duration : null;
  } catch {
    return null;
  }
}
