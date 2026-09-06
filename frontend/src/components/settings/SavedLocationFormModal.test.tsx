import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/renderWithProviders';
import { SavedLocationFormModal } from './SavedLocationFormModal';

const createSavedLocation = vi.fn();
const updateSavedLocation = vi.fn();
vi.mock('../../services/savedLocationsService', () => ({
  listSavedLocations: vi.fn().mockResolvedValue([]),
  createSavedLocation: (...args: unknown[]) => createSavedLocation(...args),
  updateSavedLocation: (...args: unknown[]) => updateSavedLocation(...args),
  deleteSavedLocation: vi.fn(),
  setDefaultSavedLocation: vi.fn(),
}));

const searchPlaces = vi.fn();
vi.mock('../../services/geocodingService', () => ({
  searchPlaces: (...args: unknown[]) => searchPlaces(...args),
}));

const PNB_SUGGESTION = {
  id: 'N1',
  address: 'PNB, 6754 Ayala Avenue, Makati',
  name: 'PNB',
  coordinates: { latitude: 14.5548495, longitude: 121.0235158 },
};

describe('SavedLocationFormModal', () => {
  it('auto-fills an empty label from a picked suggestion’s name and includes its coordinates on submit', async () => {
    searchPlaces.mockResolvedValue([PNB_SUGGESTION]);
    createSavedLocation.mockResolvedValue({ id: 'loc-1' });
    const user = userEvent.setup();

    renderWithProviders(<SavedLocationFormModal isOpen onClose={vi.fn()} />);

    await user.type(screen.getByRole('combobox', { name: 'Address' }), 'PNB Makati');
    await user.click(await screen.findByRole('option', { name: /PNB/ }));

    expect(screen.getByLabelText(/label/i)).toHaveValue('PNB');

    await user.click(screen.getByRole('button', { name: /add location/i }));

    await waitFor(() => expect(createSavedLocation).toHaveBeenCalled());
    expect(createSavedLocation.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        label: 'PNB',
        address: PNB_SUGGESTION.address,
        coordinates: PNB_SUGGESTION.coordinates,
      })
    );
  });

  it('does not overwrite a label the user already typed', async () => {
    searchPlaces.mockResolvedValue([PNB_SUGGESTION]);
    const user = userEvent.setup();

    renderWithProviders(<SavedLocationFormModal isOpen onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(/label/i), 'Home');
    await user.type(screen.getByRole('combobox', { name: 'Address' }), 'PNB Makati');
    await user.click(await screen.findByRole('option', { name: /PNB/ }));

    expect(screen.getByLabelText(/label/i)).toHaveValue('Home');
  });

  it('omits coordinates when the address is edited after picking a suggestion', async () => {
    // Falls back to write-time geocoding of whatever's finally submitted —
    // see savedLocationsService's own contract.
    searchPlaces.mockResolvedValue([PNB_SUGGESTION]);
    createSavedLocation.mockResolvedValue({ id: 'loc-1' });
    const user = userEvent.setup();

    renderWithProviders(<SavedLocationFormModal isOpen onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(/label/i), 'Work');
    await user.type(screen.getByRole('combobox', { name: 'Address' }), 'PNB Makati');
    await user.click(await screen.findByRole('option', { name: /PNB/ }));
    await user.type(screen.getByRole('combobox', { name: 'Address' }), ' 2nd Floor');

    await user.click(screen.getByRole('button', { name: /add location/i }));

    await waitFor(() => expect(createSavedLocation).toHaveBeenCalled());
    expect(createSavedLocation.mock.calls[0][0].coordinates).toBeUndefined();
  });
});
