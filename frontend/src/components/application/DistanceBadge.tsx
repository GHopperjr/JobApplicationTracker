import { useDefaultLocation } from '../../hooks/useDefaultLocation';
import { useEnsureRoadDistance } from '../../hooks/useEnsureRoadDistance';
import { formatKm, metersToKm } from '../../lib/distance';
import type { Application } from '../../services/applicationsService';

type DistanceBadgeProps = {
  application: Application;
};

/**
 * Kilometres only, no ETA — the meta row this sits in already carries
 * platform, salary, and date; travel time is what the drawer is for
 * (docs/11-navigation-and-distance.md).
 *
 * The same real road distance as the drawer's `DistanceRow`, not a
 * straight-line approximation — the two used to disagree (a straight-line
 * 2.8km came from a real ~5.4km road route), which was confusing. Reading a
 * live OSRM route per card would cost one request per visible card, so this
 * instead reads a cache (`road_distance_meters` et al.) that
 * `useEnsureRoadDistance` keeps warm in the background — rendering the
 * board still costs zero requests once every visible card's cache is warm.
 *
 * Renders nothing at all — no placeholder, no "unknown" — when there is no
 * saved location, either end lacks coordinates, or the cache hasn't
 * resolved yet. A user who hasn't set up a saved location sees exactly the
 * app they saw before this feature existed.
 */
export function DistanceBadge({ application }: DistanceBadgeProps) {
  const location = useDefaultLocation();
  useEnsureRoadDistance(application, location);

  if (
    !location ||
    location.latitude === null ||
    location.longitude === null ||
    application.location_latitude === null ||
    application.location_longitude === null ||
    application.road_distance_meters === null ||
    application.road_distance_from_lat !== location.latitude ||
    application.road_distance_from_lng !== location.longitude
  ) {
    return null;
  }

  const km = metersToKm(application.road_distance_meters);

  return (
    <span
      title={`${formatKm(km)} from ${location.label}`}
      className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600"
    >
      {formatKm(km)}
    </span>
  );
}
