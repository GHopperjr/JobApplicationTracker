import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { AddressAutocomplete, type ResolvedPlace } from '../../components/ui/AddressAutocomplete';
import { useSavedLocations } from '../../hooks/useSavedLocations';
import type { Coordinates } from '../../lib/distance';
import { savedLocationSchema } from '../../lib/validation';
import { AppError } from '../../services/errors';
import type { SavedLocation } from '../../services/savedLocationsService';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';

type SavedLocationValues = z.infer<typeof savedLocationSchema>;

type SavedLocationFormModalProps = {
  isOpen: boolean;
  location?: SavedLocation; // present in edit mode, absent in create mode
  onClose: () => void;
};

export function SavedLocationFormModal({ isOpen, location, onClose }: SavedLocationFormModalProps) {
  const { create, update } = useSavedLocations();
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Set only by picking a suggestion, cleared by any further edit to the
  // address — see AddressAutocomplete's own contract. When present at
  // submit time it's written directly, skipping the write-time geocode
  // fallback entirely (docs/11-navigation-and-distance.md).
  const [resolved, setResolved] = useState<ResolvedPlace | null>(null);
  const isEditMode = Boolean(location);

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SavedLocationValues>({
    resolver: zodResolver(savedLocationSchema),
    defaultValues: { label: location?.label ?? '', address: location?.address ?? '' },
  });

  // Clearing state is a React write, so it's adjusted during render rather
  // than from the effect below — the same pattern ApplicationFormModal uses
  // for exactly this reason (react-hooks/set-state-in-effect).
  const [lastIsOpen, setLastIsOpen] = useState(isOpen);
  if (isOpen !== lastIsOpen) {
    setLastIsOpen(isOpen);
    if (isOpen) {
      setSubmitError(null);
      setResolved(null);
    }
  }

  // `reset` is react-hook-form's own imperative API, not React state, so it
  // stays in the effect.
  useEffect(() => {
    if (isOpen) reset({ label: location?.label ?? '', address: location?.address ?? '' });
  }, [isOpen, location, reset]);

  const handleAddressResolved = (place: ResolvedPlace | null) => {
    setResolved(place);
    // A convenience only, never forced: if the label is still untouched and
    // the picked place has its own name ("PNB"), offer it as the label —
    // the user is always free to overwrite it, since a saved location's
    // label is their own nickname for the place, not tied to what OSM calls it.
    if (place?.name && !getValues('label').trim()) {
      setValue('label', place.name);
    }
  };

  const onSubmit = async (values: SavedLocationValues) => {
    setSubmitError(null);
    const coordinates: Coordinates | undefined =
      resolved && resolved.address === values.address ? resolved.coordinates : undefined;
    try {
      if (isEditMode && location) {
        await update.mutateAsync({ id: location.id, patch: { ...values, coordinates } });
      } else {
        await create.mutateAsync({ ...values, coordinates });
      }
      onClose();
    } catch (err) {
      setSubmitError(err instanceof AppError ? err.message : 'Something went wrong. Please try again.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? 'Edit location' : 'Add location'}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="saved-location-form" variant="primary" isLoading={isSubmitting}>
            {isEditMode ? 'Save changes' : 'Add location'}
          </Button>
        </div>
      }
    >
      <form id="saved-location-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="space-y-4">
          <Input
            label="Label"
            required
            autoFocus
            placeholder="Home"
            error={errors.label?.message}
            {...register('label')}
          />
          <Controller
            control={control}
            name="address"
            render={({ field }) => (
              <AddressAutocomplete
                label="Address"
                required
                placeholder="Start typing an address or place name…"
                hint="Pick a suggestion for the most precise match, or type your own — saved either way if it can't be found."
                error={errors.address?.message}
                value={field.value}
                onChange={field.onChange}
                onResolvedChange={handleAddressResolved}
              />
            )}
          />
        </div>

        {submitError && (
          <p role="alert" className="mt-4 text-xs text-rose-600">
            {submitError}
          </p>
        )}
      </form>
    </Modal>
  );
}
