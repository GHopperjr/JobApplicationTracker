import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AddressAutocomplete, type ResolvedPlace } from './AddressAutocomplete';

const searchPlaces = vi.fn();
vi.mock('../../services/geocodingService', () => ({
  searchPlaces: (...args: unknown[]) => searchPlaces(...args),
}));

const PNB: ResolvedPlace = {
  address: 'PNB, 6754 Ayala Avenue, Makati',
  name: 'PNB',
  coordinates: { latitude: 14.5548495, longitude: 121.0235158 },
};

// AddressAutocomplete is a controlled field — this wrapper owns the state a
// real form (react-hook-form's Controller) would otherwise provide.
function Harness({
  initialValue = '',
  onResolvedChange,
}: {
  initialValue?: string;
  onResolvedChange: (resolved: ResolvedPlace | null) => void;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <AddressAutocomplete
      label="Address"
      value={value}
      onChange={setValue}
      onResolvedChange={onResolvedChange}
    />
  );
}

describe('AddressAutocomplete', () => {
  it('does not search below the minimum query length', async () => {
    const user = userEvent.setup();
    render(<Harness onResolvedChange={vi.fn()} />);

    await user.type(screen.getByRole('combobox'), 'PN');

    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(searchPlaces).not.toHaveBeenCalled();
  });

  it('searches (debounced) once the query reaches the minimum length, and shows results', async () => {
    searchPlaces.mockResolvedValue([PNB]);
    const user = userEvent.setup();
    render(<Harness onResolvedChange={vi.fn()} />);

    await user.type(screen.getByRole('combobox'), 'PNB Makati');

    await waitFor(() => expect(searchPlaces).toHaveBeenCalledWith('PNB Makati'));
    expect(await screen.findByRole('option', { name: /PNB/ })).toBeInTheDocument();
  });

  it('does not search merely because the field is pre-filled on mount', async () => {
    render(<Harness initialValue="123 Rizal Street, Makati" onResolvedChange={vi.fn()} />);

    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(searchPlaces).not.toHaveBeenCalled();
  });

  it('fills the field and reports the resolved place when a suggestion is picked', async () => {
    searchPlaces.mockResolvedValue([PNB]);
    const onResolvedChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onResolvedChange={onResolvedChange} />);

    await user.type(screen.getByRole('combobox'), 'PNB Makati');
    await user.click(await screen.findByRole('option', { name: /PNB/ }));

    expect(screen.getByRole('combobox')).toHaveValue(PNB.address);
    expect(onResolvedChange).toHaveBeenCalledWith(PNB);
  });

  it('does not fire a second search for the address that was just selected', async () => {
    searchPlaces.mockResolvedValue([PNB]);
    const user = userEvent.setup();
    render(<Harness onResolvedChange={vi.fn()} />);

    await user.type(screen.getByRole('combobox'), 'PNB Makati');
    await user.click(await screen.findByRole('option', { name: /PNB/ }));

    const callCountAfterSelect = searchPlaces.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(searchPlaces).toHaveBeenCalledTimes(callCountAfterSelect);
  });

  it('clears the resolved place as soon as the field is edited again after a pick', async () => {
    searchPlaces.mockResolvedValue([PNB]);
    const onResolvedChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onResolvedChange={onResolvedChange} />);

    await user.type(screen.getByRole('combobox'), 'PNB Makati');
    await user.click(await screen.findByRole('option', { name: /PNB/ }));
    onResolvedChange.mockClear();

    await user.type(screen.getByRole('combobox'), ' 2nd Floor');

    expect(onResolvedChange).toHaveBeenCalledWith(null);
  });

  it('selects the highlighted suggestion with arrow keys + Enter', async () => {
    const second = { ...PNB, id: 'other', address: 'Makati Stock Exchange Building', name: null };
    searchPlaces.mockResolvedValue([PNB, second]);
    const onResolvedChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onResolvedChange={onResolvedChange} />);

    await user.type(screen.getByRole('combobox'), 'Ayala Avenue');
    await screen.findByRole('option', { name: /PNB/ });

    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(onResolvedChange).toHaveBeenCalledWith(
      expect.objectContaining({ address: 'Makati Stock Exchange Building' })
    );
  });

  it('renders no options and no "Searching…" text when nothing resolves', async () => {
    searchPlaces.mockResolvedValue([]);
    const user = userEvent.setup();
    render(<Harness onResolvedChange={vi.fn()} />);

    await user.type(screen.getByRole('combobox'), 'Nowhere at all');

    await waitFor(() => expect(searchPlaces).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });
});
