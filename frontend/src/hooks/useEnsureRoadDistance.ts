import { useEffect, useRef } from 'react';
import { updateApplicationRoadDistance } from '../services/applicationsService';
import type { Application } from '../services/applicationsService';
import { getDrivingRoute } from '../services/routingService';
import type { SavedLocation } from '../services/savedLocationsService';

function isCacheValid(application: Application, location: SavedLocation): boolean {
  return (
    application.road_distance_meters !== null &&
    application.road_distance_from_lat === location.latitude &&
    application.road_distance_from_lng === location.longitude
  );
}

/**
 * Keeps the card/row badge's road-distance cache warm without ever calling
 * OSRM at render time (docs/11-navigation-and-distance.md). Only fires when
 * the cache is missing or was computed against a different default location
 * (a different location, or the same one after its address changed) —
 * in the steady state, rendering the board costs zero requests, matching
 * the invariant the feature was built around.
 *
 * The in-flight ref (read/written only inside the effect, never during
 * render) stops a re-render that lands before the write resolves from firing
 * a second, redundant OSRM call for the same pair.
 */
export function useEnsureRoadDistance(
  application: Application,
  location: SavedLocation | null
): void {
  const inFlightKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      !location ||
      location.latitude === null ||
      location.longitude === null ||
      application.location_latitude === null ||
      application.location_longitude === null ||
      isCacheValid(application, location)
    ) {
      return;
    }

    const key = `${application.id}:${location.latitude}:${location.longitude}`;
    if (inFlightKeyRef.current === key) return;
    inFlightKeyRef.current = key;

    void (async () => {
      const route = await getDrivingRoute(
        { latitude: application.location_latitude!, longitude: application.location_longitude! },
        { latitude: location.latitude!, longitude: location.longitude! }
      );
      if (!route) return;
      await updateApplicationRoadDistance(application.id, {
        roadDistanceMeters: route.distanceMeters,
        roadDurationSeconds: route.durationSeconds,
        roadDistanceFromLat: location.latitude!,
        roadDistanceFromLng: location.longitude!,
      });
    })();
  }, [application, location]);
}
