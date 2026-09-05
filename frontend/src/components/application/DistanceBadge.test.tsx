import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Application } from '../../services/applicationsService';
import type { SavedLocation } from '../../services/savedLocationsService';
import { renderWithProviders } from '../../test/renderWithProviders';
import { DistanceBadge } from './DistanceBadge';

const listSavedLocations = vi.fn();
vi.mock('../../services/savedLocationsService', () => ({
  listSavedLocations: () => listSavedLocations(),
  createSavedLocation: vi.fn(),
  updateSavedLocation: vi.fn(),
  deleteSavedLocation: vi.fn(),
  setDefaultSavedLocation: vi.fn(),
}));

const HOME = {
  id: 'loc-1',
  label: 'Home',
  latitude: 14.5995,
  longitude: 120.9842,
  is_default: true,
} as SavedLocation;

const application = (overrides: Partial<Application>) =>
  ({
    id: 'app-1',
    company_name: 'Acme',
    location_latitude: 14.5547,
    location_longitude: 121.0244,
    ...overrides,
  }) as Application;

describe('DistanceBadge', () => {
  it('renders the kilometre distance from the default saved location', async () => {
    listSavedLocations.mockResolvedValue([HOME]);

    renderWithProviders(<DistanceBadge application={application({})} />);

    expect(await screen.findByText('6.6 km')).toBeInTheDocument();
  });

  // docs/11-navigation-and-distance.md: no placeholders, no "unknown" — a
  // user without saved locations sees precisely the app they saw before.
  it('renders nothing when there are no saved locations', async () => {
    listSavedLocations.mockResolvedValue([]);

    const { container } = renderWithProviders(<DistanceBadge application={application({})} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the application has no coordinates', async () => {
    listSavedLocations.mockResolvedValue([HOME]);

    const { container } = renderWithProviders(
      <DistanceBadge
        application={application({ location_latitude: null, location_longitude: null })}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the saved location never geocoded', async () => {
    listSavedLocations.mockResolvedValue([{ ...HOME, latitude: null, longitude: null }]);

    const { container } = renderWithProviders(<DistanceBadge application={application({})} />);

    expect(container).toBeEmptyDOMElement();
  });
});
