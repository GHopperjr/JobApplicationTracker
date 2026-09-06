import { useState } from 'react';
import { useDrivingEta } from '../../hooks/useDrivingEta';
import { useSavedLocations } from '../../hooks/useSavedLocations';
import { formatDuration, formatKm, haversineKm, metersToKm } from '../../lib/distance';
import type { Application } from '../../services/applicationsService';

type DistanceRowProps = {
  application: Application;
};

/**
 * The drawer's distance line. Shows OSRM's real road distance once the
 * route resolves — deliberately different from the card badge's
 * straight-line figure (`DistanceBadge`), which stays cheap and
 * network-free. The two numbers can disagree, and that's the point: the
 * badge trades accuracy for zero cost everywhere; the drawer, opened
 * rarely and deliberately, can afford one live call for a materially
 * better number. Verified live: a straight-line 2.8km came from a real
 * 5.35km route, close to Google's own distance for the same real address
 * (docs/11-navigation-and-distance.md).
 *
 * Falls back to the straight-line distance (no ETA clause) while the route
 * is loading or if it fails — the two numbers already fail independently
 * per the routing service's own contract.
 *
 * Which location to measure from is transient component state, initialised
 * from the default and reset whenever a different application is shown;
 * `is_default` is that initial value, not a persistent selection. The
 * selector only appears when there is more than one saved location — with
 * exactly one there is nothing to choose.
 */
export function DistanceRow({ application }: DistanceRowProps) {
  const { locations } = useSavedLocations();
  const [overrideId, setOverrideId] = useState<string | null>(null);

  // Reset the override during render rather than in an effect when the
  // drawer swings to a different application (the react-hooks/
  // set-state-in-effect pattern used throughout this codebase).
  const [lastApplicationId, setLastApplicationId] = useState(application.id);
  if (application.id !== lastApplicationId) {
    setLastApplicationId(application.id);
    setOverrideId(null);
  }

  // `overrideId` staying null until the user picks something means this
  // naturally resolves to the default once the query settles, with no
  // second reconciliation step.
  const defaultLocation = locations.find((location) => location.is_default) ?? locations[0] ?? null;
  const selected = locations.find((location) => location.id === overrideId) ?? defaultLocation;

  const from =
    selected && selected.latitude !== null && selected.longitude !== null
      ? { latitude: selected.latitude, longitude: selected.longitude }
      : null;
  const to =
    application.location_latitude !== null && application.location_longitude !== null
      ? { latitude: application.location_latitude, longitude: application.location_longitude }
      : null;

  const { data: route } = useDrivingEta(from, to);

  if (!selected || !from || !to) return null;

  const km = route ? metersToKm(route.distanceMeters) : haversineKm(from, to);

  return (
    <div className="flex gap-4 py-1 text-sm">
      <dt className="w-24 shrink-0 text-xs font-medium text-slate-600">Distance</dt>
      <dd className="flex flex-1 flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-slate-900">
            {formatKm(km)} from {selected.label}
            {route && ` · ${formatDuration(route.durationSeconds)}`}
          </span>
          {route && <p className="text-xs text-slate-400">No live traffic factored in</p>}
        </div>
        {locations.length > 1 && (
          <select
            aria-label="Measure distance from"
            value={selected.id}
            onChange={(event) => setOverrideId(event.target.value)}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700"
          >
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.label}
              </option>
            ))}
          </select>
        )}
      </dd>
    </div>
  );
}
