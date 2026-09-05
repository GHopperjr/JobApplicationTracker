import { useState } from 'react';
import { useSavedLocations } from '../../hooks/useSavedLocations';
import { useToast } from '../../hooks/useToast';
import type { SavedLocation } from '../../services/savedLocationsService';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { EmptyState } from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';
import { SavedLocationFormModal } from './SavedLocationFormModal';

export function SavedLocationList() {
  const { locations, isLoading, remove, setDefault } = useSavedLocations();
  const { show } = useToast();
  const [formState, setFormState] = useState<{ open: boolean; location?: SavedLocation }>({
    open: false,
  });
  const [pendingDelete, setPendingDelete] = useState<SavedLocation | null>(null);

  const handleDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    try {
      await remove.mutateAsync(target.id);
      show('Location deleted.');
    } catch {
      show("Couldn't delete that location. Please try again.", 'error');
    }
  };

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Saved locations</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Places you might commute from. Distances on your applications are measured from the
            default one.
          </p>
        </div>
        <Button variant="primary" onClick={() => setFormState({ open: true })}>
          Add location
        </Button>
      </div>

      {isLoading ? (
        <Skeleton variant="row" count={2} />
      ) : locations.length === 0 ? (
        <EmptyState
          message="No saved locations yet."
          action={{ label: 'Add your first location', onClick: () => setFormState({ open: true }) }}
        />
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
          {locations.map((location) => (
            <li key={location.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-slate-900">{location.label}</span>
                  {location.is_default && (
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      Default
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-slate-500">{location.address}</p>
                {/* Not an error state and it blocks nothing — it just
                    explains why this location will never produce a distance
                    (docs/11-navigation-and-distance.md). */}
                {location.latitude === null && (
                  <p className="mt-0.5 text-xs text-slate-400">
                    Distance unavailable for this address.
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {!location.is_default && (
                  <Button size="sm" variant="ghost" onClick={() => setDefault.mutate(location.id)}>
                    Make default
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setFormState({ open: true, location })}
                >
                  Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setPendingDelete(location)}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Nominatim's usage policy requires attribution wherever its results
          are shown (docs/11-navigation-and-distance.md). */}
      <p className="mt-3 text-xs text-slate-400">© OpenStreetMap contributors</p>

      <SavedLocationFormModal
        isOpen={formState.open}
        location={formState.location}
        onClose={() => setFormState({ open: false })}
      />

      <ConfirmDialog
        isOpen={Boolean(pendingDelete)}
        title="Delete location"
        message={
          pendingDelete
            ? `Delete "${pendingDelete.label}"? Distances measured from it will stop showing.`
            : ''
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  );
}
