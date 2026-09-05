import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { PLATFORM_LABELS, PLATFORM_ORDER } from '../../constants/platforms';
import { STATUS_LABELS, STATUS_ORDER } from '../../constants/status';
import { WORK_SETUP_LABELS, WORK_SETUP_ORDER } from '../../constants/workSetup';
import { useApplicationMutations } from '../../hooks/useApplicationMutations';
import { useToast } from '../../hooks/useToast';
import { applicationSchema } from '../../lib/validation';
import { AppError } from '../../services/errors';
import { toFormValues, type ApplicationFormValues } from '../../types/application';
import type { Application } from '../../services/applicationsService';
import { SalaryRangeField } from './SalaryRangeField';

type ApplicationFormModalProps = {
  isOpen: boolean;
  application?: Application; // present in edit mode, absent in create mode
  onClose: () => void;
};

// Bare domains ("www.linkedin.com/jobs/1") are common paste-ins. Silently
// correcting them on blur is friendlier than erroring on a fixable mistake.
function autoPrefixUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || /^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function ApplicationFormModal({ isOpen, application, onClose }: ApplicationFormModalProps) {
  const isEditMode = Boolean(application);
  const { show } = useToast();
  const { create, update } = useApplicationMutations({
    onCreated: () => show('Application added.'),
    onUpdated: () => show('Changes saved.'),
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors, isSubmitting, isDirty, dirtyFields },
  } = useForm<ApplicationFormValues>({
    resolver: zodResolver(applicationSchema),
    defaultValues: toFormValues(application),
  });

  // Re-seed the form whenever the target record changes (a different row was
  // opened for edit, or the modal is reopened in create mode).
  useEffect(() => {
    if (isOpen) reset(toFormValues(application));
  }, [isOpen, application, reset]);

  const requestClose = () => {
    if (isDirty) {
      setDiscardConfirmOpen(true);
      return;
    }
    onClose();
  };

  const onSubmit = async (values: ApplicationFormValues) => {
    setSubmitError(null);
    try {
      if (isEditMode && application) {
        // Only changed fields are sent as the patch.
        const patch = Object.fromEntries(
          Object.keys(dirtyFields).map((key) => [key, values[key as keyof ApplicationFormValues]])
        );
        await update.mutateAsync({ id: application.id, patch });
      } else {
        await create.mutateAsync(values);
      }
      onClose();
    } catch (err) {
      setSubmitError(err instanceof AppError ? err.message : 'Something went wrong. Please try again.');
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={requestClose}
        closeOnBackdrop={!isDirty}
        title={isEditMode ? 'Edit Application' : 'Add Application'}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={requestClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="application-form"
              variant="primary"
              isLoading={isSubmitting}
            >
              {isEditMode ? 'Save changes' : 'Add Application'}
            </Button>
          </div>
        }
      >
        <form id="application-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="space-y-4">
            <Input
              label="Company name"
              required
              autoFocus
              error={errors.company_name?.message}
              {...register('company_name')}
            />
            <Input label="Job title" required error={errors.job_title?.message} {...register('job_title')} />
            <Select label="Platform" required {...register('platform_source')}>
              {PLATFORM_ORDER.map((p) => (
                <option key={p} value={p}>
                  {PLATFORM_LABELS[p]}
                </option>
              ))}
            </Select>
            <Select label="Status" required {...register('status')}>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </div>

          <hr className="my-4 border-slate-200" />

          <div className="space-y-4">
            <Input
              label="Job link"
              error={errors.job_link?.message}
              {...register('job_link', {
                onBlur: (e) => setValue('job_link', autoPrefixUrl(e.target.value), { shouldValidate: true }),
              })}
            />
            <Input label="Location" error={errors.location?.message} {...register('location')} />
            <Select label="Work setup" error={errors.work_setup?.message} {...register('work_setup')}>
              <option value="">Not specified</option>
              {WORK_SETUP_ORDER.map((w) => (
                <option key={w} value={w}>
                  {WORK_SETUP_LABELS[w]}
                </option>
              ))}
            </Select>
            <Controller
              control={control}
              name="salary_range"
              render={({ field }) => (
                <SalaryRangeField
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.salary_range?.message}
                />
              )}
            />
            <Input
              label="Applied date"
              type="date"
              error={errors.applied_date?.message}
              {...register('applied_date')}
            />
            <Textarea label="Notes" error={errors.notes?.message} {...register('notes')} />
          </div>

          {submitError && (
            <p role="alert" className="mt-4 text-xs text-rose-600">
              {submitError}
            </p>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={discardConfirmOpen}
        title="Discard changes?"
        message="You have unsaved changes. Are you sure you want to discard them?"
        confirmLabel="Discard"
        variant="destructive"
        onConfirm={() => {
          setDiscardConfirmOpen(false);
          reset(toFormValues(application));
          onClose();
        }}
        onCancel={() => setDiscardConfirmOpen(false)}
      />
    </>
  );
}
