import { useState } from 'react';
import { useDrivingEta } from '../../hooks/useDrivingEta';
import { useSavedLocations } from '../../hooks/useSavedLocations';
import { formatDuration, formatKm, metersToKm } from '../../lib/distance';
import type { Application } from '../../services/applicationsService';

type DistanceRowProps = {
  application: Application;
};

/**
 * The drawer's distance line. Shows OSRM's real road distance once the
 * route resolves — no straight-line approximation anywhere in this row,
 * including while switching which saved location to measure from, so the
 * figure shown always matches the real road route (docs/11-navigation-and-
 * distance.md). While a route is in flight, or if it fails outright, the
 * row says so in place of a number rather than showing an approximation
 * that could be materially wrong (verified live: a straight-line 2.8km once
 * stood in for a real 5.35km route).
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

  const { data: route, isLoading } = useDrivingEta(from, to);

  if (!selected || !from || !to) return null;

  return (
    <div className="flex gap-4 py-1 text-sm">
      <dt className="w-24 shrink-0 text-xs font-medium text-slate-600">Distance</dt>
      <dd className="flex flex-1 flex-wrap items-center justify-between gap-2">
        <div>
          {isLoading ? (
            <span className="text-slate-400">Calculating distance…</span>
          ) : route ? (
            <>
              <span className="text-slate-900">
                {formatKm(metersToKm(route.distanceMeters))} from {selected.label} ·{' '}
                {formatDuration(route.durationSeconds)}
              </span>
              <p className="text-xs text-slate-400">No live traffic factored in</p>
            </>
          ) : (
            <span className="text-slate-400">Distance unavailable</span>
          )}
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
