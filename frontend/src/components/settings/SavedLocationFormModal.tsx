import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useSavedLocations } from '../../hooks/useSavedLocations';
import { AppError } from '../../services/errors';
import type { SavedLocation } from '../../services/savedLocationsService';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';

// Mirrors the table's own check constraints (docs/11's schema) so the user
// gets the real message instead of an opaque 23514.
const savedLocationSchema = z.object({
  label: z.string().trim().min(1, 'Label is required').max(60, 'Keep the label under 60 characters'),
  address: z
    .string()
    .trim()
    .min(1, 'Address is required')
    .max(300, 'Keep the address under 300 characters'),
});

type SavedLocationValues = z.infer<typeof savedLocationSchema>;

type SavedLocationFormModalProps = {
  isOpen: boolean;
  location?: SavedLocation; // present in edit mode, absent in create mode
  onClose: () => void;
};

export function SavedLocationFormModal({ isOpen, location, onClose }: SavedLocationFormModalProps) {
  const { create, update } = useSavedLocations();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isEditMode = Boolean(location);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SavedLocationValues>({
    resolver: zodResolver(savedLocationSchema),
    defaultValues: { label: location?.label ?? '', address: location?.address ?? '' },
  });

  // Clearing the error is a React state write, so it's adjusted during
  // render rather than from the effect below — the same pattern
  // ApplicationFormModal uses for exactly this reason
  // (react-hooks/set-state-in-effect).
  const [lastIsOpen, setLastIsOpen] = useState(isOpen);
  if (isOpen !== lastIsOpen) {
    setLastIsOpen(isOpen);
    if (isOpen) setSubmitError(null);
  }

  // `reset` is react-hook-form's own imperative API, not React state, so it
  // stays in the effect.
  useEffect(() => {
    if (isOpen) reset({ label: location?.label ?? '', address: location?.address ?? '' });
  }, [isOpen, location, reset]);

  const onSubmit = async (values: SavedLocationValues) => {
    setSubmitError(null);
    try {
      if (isEditMode && location) {
        await update.mutateAsync({ id: location.id, patch: values });
      } else {
        await create.mutateAsync(values);
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
          <Input
            label="Address"
            required
            placeholder="123 Rizal Street, Makati City"
            hint="Used to measure distance to a job's location. Saved either way if it can't be found."
            error={errors.address?.message}
            {...register('address')}
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
