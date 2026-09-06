import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Application } from '../../services/applicationsService';
import type { SavedLocation } from '../../services/savedLocationsService';
import { renderWithProviders } from '../../test/renderWithProviders';
import { DistanceRow } from './DistanceRow';

const listSavedLocations = vi.fn();
vi.mock('../../services/savedLocationsService', () => ({
  listSavedLocations: () => listSavedLocations(),
  createSavedLocation: vi.fn(),
  updateSavedLocation: vi.fn(),
  deleteSavedLocation: vi.fn(),
  setDefaultSavedLocation: vi.fn(),
}));

const getDrivingRoute = vi.fn();
vi.mock('../../services/routingService', () => ({
  getDrivingRoute: (...args: unknown[]) => getDrivingRoute(...args),
}));

const HOME: SavedLocation = {
  id: 'loc-1',
  label: 'Home',
  latitude: 14.5995,
  longitude: 120.9842,
  is_default: true,
} as SavedLocation;

const OFFICE: SavedLocation = {
  id: 'loc-2',
  label: 'Office',
  latitude: 14.55,
  longitude: 121.02,
  is_default: false,
} as SavedLocation;

const application = (overrides: Partial<Application> = {}) =>
  ({
    id: 'app-1',
    company_name: 'Acme',
    location_latitude: 14.5547,
    location_longitude: 121.0244,
    ...overrides,
  }) as Application;

describe('DistanceRow', () => {
  it('renders nothing when there is no saved location', async () => {
    listSavedLocations.mockResolvedValue([]);
    const { container } = renderWithProviders(<DistanceRow application={application()} />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('shows a loading state while the route has not resolved, with no distance or ETA', async () => {
    listSavedLocations.mockResolvedValue([HOME]);
    getDrivingRoute.mockReturnValue(new Promise(() => {})); // never resolves

    renderWithProviders(<DistanceRow application={application()} />);

    expect(await screen.findByText(/calculating distance/i)).toBeInTheDocument();
    expect(screen.queryByText(/km from Home/)).not.toBeInTheDocument();
    expect(screen.queryByText(/no live traffic/i)).not.toBeInTheDocument();
  });

  it('switches to the real road distance, the ETA, and the traffic caveat once the route resolves', async () => {
    listSavedLocations.mockResolvedValue([HOME]);
    getDrivingRoute.mockResolvedValue({ durationSeconds: 420, distanceMeters: 5346.9 });

    renderWithProviders(<DistanceRow application={application()} />);

    expect(await screen.findByText('5.3 km from Home · ~7 min by car')).toBeInTheDocument();
    expect(screen.getByText(/no live traffic factored in/i)).toBeInTheDocument();
  });

  it('shows a fallback message, no straight-line distance, if the route fails', async () => {
    listSavedLocations.mockResolvedValue([HOME]);
    getDrivingRoute.mockResolvedValue(null);

    renderWithProviders(<DistanceRow application={application()} />);

    expect(await screen.findByText(/distance unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText(/km from Home/)).not.toBeInTheDocument();
  });

  it('hides the location selector with exactly one saved location', async () => {
    listSavedLocations.mockResolvedValue([HOME]);
    getDrivingRoute.mockResolvedValue(null);

    renderWithProviders(<DistanceRow application={application()} />);

    await screen.findByText(/distance unavailable/i);
    expect(screen.queryByRole('combobox', { name: /measure distance from/i })).not.toBeInTheDocument();
  });

  it('shows the location selector with more than one saved location', async () => {
    listSavedLocations.mockResolvedValue([HOME, OFFICE]);
    getDrivingRoute.mockResolvedValue(null);

    renderWithProviders(<DistanceRow application={application()} />);

    expect(
      await screen.findByRole('combobox', { name: /measure distance from/i })
    ).toBeInTheDocument();
  });

  it('lets the user switch which saved location to measure from', async () => {
    listSavedLocations.mockResolvedValue([HOME, OFFICE]);
    getDrivingRoute.mockResolvedValue({ durationSeconds: 300, distanceMeters: 3000 });
    const user = userEvent.setup();

    renderWithProviders(<DistanceRow application={application()} />);

    const selector = await screen.findByRole('combobox', { name: /measure distance from/i });
    expect(await screen.findByText(/from Home/)).toBeInTheDocument();

    await user.selectOptions(selector, 'loc-2');

    expect(await screen.findByText(/from Office/)).toBeInTheDocument();
  });
});
