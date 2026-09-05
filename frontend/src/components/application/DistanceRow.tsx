import { useState } from 'react';
import { useDrivingEta } from '../../hooks/useDrivingEta';
import { useSavedLocations } from '../../hooks/useSavedLocations';
import { formatDuration, formatKm, haversineKm } from '../../lib/distance';
import type { Application } from '../../services/applicationsService';

type DistanceRowProps = {
  application: Application;
};

/**
 * The drawer's distance line: kilometres from a saved location, plus a
 * driving ETA when routing answers. The two numbers fail independently — a
 * slow or failed OSRM call omits only the "~N min by car" clause
 * (docs/11-navigation-and-distance.md).
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

  const { data: etaSeconds } = useDrivingEta(from, to);

  if (!selected || !from || !to) return null;

  return (
    <div className="flex gap-4 py-1 text-sm">
      <dt className="w-24 shrink-0 text-xs font-medium text-slate-600">Distance</dt>
      <dd className="flex flex-1 flex-wrap items-center justify-between gap-2 text-slate-900">
        <span>
          {formatKm(haversineKm(from, to))} from {selected.label}
          {typeof etaSeconds === 'number' && ` · ${formatDuration(etaSeconds)}`}
        </span>
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
