import { geocodeAddress } from './geocodingService';
import { toAppError } from './errors';
import { supabase } from './supabaseClient';
import type { Database } from '../types/database.types';

export type SavedLocation = Database['public']['Tables']['saved_locations']['Row'];

export async function listSavedLocations(): Promise<SavedLocation[]> {
  const { data, error } = await supabase
    .from('saved_locations')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw toAppError(error);
  return data ?? [];
}

/**
 * Inserted first, geocoded after, and the geocode IS awaited here (unlike
 * applications' create/update) — saved locations are a rare, deliberate
 * settings action ("a handful of times, ever" per docs/11), not the hot
 * path, so waiting for one Nominatim round trip before showing the result
 * is simpler than plumbing a background-refresh path for something this
 * infrequent. A failed geocode still returns the saved row, just without
 * coordinates — it is never an error.
 */
export async function createSavedLocation(input: {
  label: string;
  address: string;
}): Promise<SavedLocation> {
  const { data, error } = await supabase
    .from('saved_locations')
    .insert({ label: input.label.trim(), address: input.address.trim() })
    .select()
    .single();
  if (error) throw toAppError(error);

  const coords = await geocodeAddress(data.address);
  if (!coords) return data;

  const { data: geocoded } = await supabase
    .from('saved_locations')
    .update({ latitude: coords.latitude, longitude: coords.longitude })
    .eq('id', data.id)
    .select()
    .single();
  return geocoded ?? data;
}

export async function updateSavedLocation(
  id: string,
  patch: { label?: string; address?: string }
): Promise<SavedLocation> {
  const normalized: { label?: string; address?: string } = {};
  if (patch.label !== undefined) normalized.label = patch.label.trim();
  if (patch.address !== undefined) normalized.address = patch.address.trim();

  const { data, error } = await supabase
    .from('saved_locations')
    .update(normalized)
    .eq('id', id)
    .select()
    .single();
  if (error) throw toAppError(error);

  // Only the address actually changing re-geocodes — editing just the label
  // shouldn't cost a network call (docs/11's write-time trigger table).
  if (normalized.address === undefined) return data;

  const coords = await geocodeAddress(normalized.address);
  const { data: geocoded, error: patchError } = await supabase
    .from('saved_locations')
    .update({ latitude: coords?.latitude ?? null, longitude: coords?.longitude ?? null })
    .eq('id', id)
    .select()
    .single();
  if (patchError) throw toAppError(patchError);
  return geocoded;
}

export async function deleteSavedLocation(id: string): Promise<void> {
  const { error } = await supabase.from('saved_locations').delete().eq('id', id);
  if (error) throw toAppError(error);
}

/**
 * Two-statement default promotion (docs/11): clear every existing default
 * for this user, then set the new one. Not wrapped in a database
 * transaction — PostgREST exposes none — so the partial unique index
 * (saved_locations_one_default_per_user) is the actual safety net if this
 * ever raced itself.
 */
export async function setDefaultSavedLocation(id: string): Promise<void> {
  const { data: current, error: fetchError } = await supabase
    .from('saved_locations')
    .select('id')
    .eq('is_default', true);
  if (fetchError) throw toAppError(fetchError);

  if (current && current.length > 0) {
    const { error: clearError } = await supabase
      .from('saved_locations')
      .update({ is_default: false })
      .in(
        'id',
        current.map((row) => row.id)
      );
    if (clearError) throw toAppError(clearError);
  }

  const { error } = await supabase.from('saved_locations').update({ is_default: true }).eq('id', id);
  if (error) throw toAppError(error);
}
