import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Application } from '../services/applicationsService';
import type { SavedLocation } from '../services/savedLocationsService';
import { useEnsureRoadDistance } from './useEnsureRoadDistance';

const getDrivingRoute = vi.fn();
vi.mock('../services/routingService', () => ({
  getDrivingRoute: (...args: unknown[]) => getDrivingRoute(...args),
}));

const updateApplicationRoadDistance = vi.fn();
vi.mock('../services/applicationsService', () => ({
  updateApplicationRoadDistance: (...args: unknown[]) => updateApplicationRoadDistance(...args),
}));

const HOME: SavedLocation = {
  id: 'loc-1',
  label: 'Home',
  latitude: 14.5995,
  longitude: 120.9842,
  is_default: true,
} as SavedLocation;

const application = (overrides: Partial<Application> = {}) =>
  ({
    id: 'app-1',
    company_name: 'Acme',
    location_latitude: 14.5547,
    location_longitude: 121.0244,
    road_distance_meters: null,
    road_duration_seconds: null,
    road_distance_from_lat: null,
    road_distance_from_lng: null,
    ...overrides,
  }) as Application;

describe('useEnsureRoadDistance', () => {
  it('does nothing when there is no saved location', async () => {
    renderHook(() => useEnsureRoadDistance(application(), null));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getDrivingRoute).not.toHaveBeenCalled();
  });

  it('does nothing when the application has no coordinates', async () => {
    renderHook(() =>
      useEnsureRoadDistance(
        application({ location_latitude: null, location_longitude: null }),
        HOME
      )
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getDrivingRoute).not.toHaveBeenCalled();
  });

  it('does nothing when the cache already matches the current default location', async () => {
    renderHook(() =>
      useEnsureRoadDistance(
        application({
          road_distance_meters: 6620,
          road_distance_from_lat: HOME.latitude,
          road_distance_from_lng: HOME.longitude,
        }),
        HOME
      )
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getDrivingRoute).not.toHaveBeenCalled();
  });

  it('computes and persists the road distance when the cache is missing', async () => {
    getDrivingRoute.mockResolvedValue({ distanceMeters: 6620, durationSeconds: 540 });

    renderHook(() => useEnsureRoadDistance(application(), HOME));

    await waitFor(() => expect(updateApplicationRoadDistance).toHaveBeenCalled());
    expect(getDrivingRoute).toHaveBeenCalledWith(
      { latitude: 14.5547, longitude: 121.0244 },
      { latitude: HOME.latitude, longitude: HOME.longitude }
    );
    expect(updateApplicationRoadDistance).toHaveBeenCalledWith('app-1', {
      roadDistanceMeters: 6620,
      roadDurationSeconds: 540,
      roadDistanceFromLat: HOME.latitude,
      roadDistanceFromLng: HOME.longitude,
    });
  });

  it('recomputes when the cache was computed against a different location', async () => {
    getDrivingRoute.mockResolvedValue({ distanceMeters: 6620, durationSeconds: 540 });

    renderHook(() =>
      useEnsureRoadDistance(
        application({ road_distance_meters: 9999, road_distance_from_lat: 0, road_distance_from_lng: 0 }),
        HOME
      )
    );

    await waitFor(() => expect(getDrivingRoute).toHaveBeenCalled());
  });

  it('does not persist anything if the route lookup fails', async () => {
    getDrivingRoute.mockResolvedValue(null);

    renderHook(() => useEnsureRoadDistance(application(), HOME));

    await waitFor(() => expect(getDrivingRoute).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(updateApplicationRoadDistance).not.toHaveBeenCalled();
  });

  it('does not fire a second lookup on a re-render with the same stale inputs', async () => {
    getDrivingRoute.mockReturnValue(new Promise(() => {})); // never resolves

    const { rerender } = renderHook(
      ({ application: app, location }) => useEnsureRoadDistance(app, location),
      { initialProps: { application: application(), location: HOME } }
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getDrivingRoute).toHaveBeenCalledTimes(1);

    rerender({ application: application(), location: HOME });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getDrivingRoute).toHaveBeenCalledTimes(1);
  });
});
