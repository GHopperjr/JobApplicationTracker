import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/renderWithProviders';
import { ApplicationFormModal } from './ApplicationFormModal';

const createApplication = vi.fn();
const findPotentialDuplicates = vi.fn();
vi.mock('../../services/applicationsService', async () => {
  const actual = await vi.importActual<typeof import('../../services/applicationsService')>(
    '../../services/applicationsService'
  );
  return {
    ...actual,
    createApplication: (...args: unknown[]) => createApplication(...args),
    findPotentialDuplicates: (...args: unknown[]) => findPotentialDuplicates(...args),
  };
});

const searchPlaces = vi.fn();
vi.mock('../../services/geocodingService', () => ({
  searchPlaces: (...args: unknown[]) => searchPlaces(...args),
  geocodeAddress: vi.fn(),
}));

const PNB_SUGGESTION = {
  id: 'N1',
  address: 'PNB, 6754 Ayala Avenue, Makati',
  name: 'PNB',
  coordinates: { latitude: 14.5548495, longitude: 121.0235158 },
};

describe('ApplicationFormModal', () => {
  it('surfaces validation errors and blocks submit when required fields are blank', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ApplicationFormModal isOpen onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /add application/i }));

    expect(await screen.findByText(/company name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/job title is required/i)).toBeInTheDocument();
  });

  it('includes coordinates from a picked location suggestion on submit', async () => {
    findPotentialDuplicates.mockResolvedValue([]);
    createApplication.mockResolvedValue({ id: 'app-1' });
    searchPlaces.mockResolvedValue([PNB_SUGGESTION]);
    const user = userEvent.setup();

    renderWithProviders(<ApplicationFormModal isOpen onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(/company name/i), 'Acme');
    await user.type(screen.getByLabelText(/job title/i), 'Engineer');
    await user.type(screen.getByRole('combobox', { name: /location/i }), 'PNB Makati');
    await user.click(await screen.findByRole('option', { name: /PNB/ }));

    await user.click(screen.getByRole('button', { name: /add application/i }));

    await waitFor(() => expect(createApplication).toHaveBeenCalled());
    expect(createApplication.mock.calls[0][0]).toMatchObject({
      location: PNB_SUGGESTION.address,
      location_latitude: PNB_SUGGESTION.coordinates.latitude,
      location_longitude: PNB_SUGGESTION.coordinates.longitude,
    });
  });

  it('omits coordinates when no suggestion was ever picked — the write-time fallback covers it', async () => {
    findPotentialDuplicates.mockResolvedValue([]);
    createApplication.mockResolvedValue({ id: 'app-1' });
    const user = userEvent.setup();

    renderWithProviders(<ApplicationFormModal isOpen onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(/company name/i), 'Acme');
    await user.type(screen.getByLabelText(/job title/i), 'Engineer');
    await user.type(screen.getByRole('combobox', { name: /location/i }), 'Somewhere free-typed');

    await user.click(screen.getByRole('button', { name: /add application/i }));

    await waitFor(() => expect(createApplication).toHaveBeenCalled());
    expect(createApplication.mock.calls[0][0].location_latitude).toBeUndefined();
    expect(createApplication.mock.calls[0][0].location_longitude).toBeUndefined();
  });
});
