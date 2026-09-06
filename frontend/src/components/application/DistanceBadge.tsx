import { useDefaultLocation } from '../../hooks/useDefaultLocation';
import { formatKm, haversineKm } from '../../lib/distance';
import type { Application } from '../../services/applicationsService';

type DistanceBadgeProps = {
  application: Application;
};

/**
 * Kilometres only, no ETA — the meta row this sits in already carries
 * platform, salary, and date; travel time is what the drawer is for
 * (docs/11-navigation-and-distance.md).
 *
 * This is straight-line distance, deliberately — the drawer's `DistanceRow`
 * shows the real road distance instead, which needs a live OSRM call this
 * badge intentionally avoids. The two numbers can disagree (verified live:
 * a 2.8km straight-line figure came from a real ~5.4km road route), so the
 * tooltip says "straight-line" rather than implying it's the road distance.
 *
 * Renders nothing at all — no placeholder, no "unknown" — when there is no
 * saved location, or either end lacks coordinates. A user who hasn't set up
 * a saved location sees exactly the app they saw before this feature
 * existed.
 *
 * Costs no network request: by the time a card renders, both coordinate
 * pairs are already columns on rows that were fetched anyway.
 */
export function DistanceBadge({ application }: DistanceBadgeProps) {
  const location = useDefaultLocation();

  if (
    !location ||
    location.latitude === null ||
    location.longitude === null ||
    application.location_latitude === null ||
    application.location_longitude === null
  ) {
    return null;
  }

  const km = haversineKm(
    { latitude: location.latitude, longitude: location.longitude },
    { latitude: application.location_latitude, longitude: application.location_longitude }
  );

  return (
    <span
      title={`${formatKm(km)} from ${location.label} (straight-line)`}
      className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600"
    >
      {formatKm(km)}
    </span>
  );
}
