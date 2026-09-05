import type { SavedLocation } from '../services/savedLocationsService';
import { useSavedLocations } from './useSavedLocations';

/**
 * The saved location distances are measured from when nothing else is
 * chosen — the card/row badge always uses this, and the drawer's selector
 * starts here (docs/11-navigation-and-distance.md: `is_default` is the
 * selector's initial value, not what it persistently tracks).
 *
 * Falls back to the first saved location when none is explicitly marked
 * default: with a single saved location there is nothing to choose, and
 * requiring the user to also mark it default before any distance appears
 * would be a setup step with no decision in it.
 */
export function useDefaultLocation(): SavedLocation | null {
  const { locations } = useSavedLocations();
  return locations.find((location) => location.is_default) ?? locations[0] ?? null;
}
