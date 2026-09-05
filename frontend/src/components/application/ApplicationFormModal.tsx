import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { PLATFORM_LABELS, PLATFORM_ORDER } from '../../constants/platforms';
import { ROUTES } from '../../constants/routes';
import { STATUS_LABELS, STATUS_ORDER } from '../../constants/status';
import { WORK_SETUP_LABELS, WORK_SETUP_ORDER } from '../../constants/workSetup';
import { useApplicationMutations } from '../../hooks/useApplicationMutations';
import { useToast } from '../../hooks/useToast';
import { applicationSchema } from '../../lib/validation';
import { findPotentialDuplicates } from '../../services/applicationsService';
import { AppError } from '../../services/errors';
import { toFormValues, type ApplicationFormValues } from '../../types/application';
import type { Application } from '../../services/applicationsService';
import { autoPrefixUrl } from '../../lib/url';
import { SalaryRangeField } from './SalaryRangeField';

type ApplicationFormModalProps = {
  isOpen: boolean;
  application?: Application; // present in edit mode, absent in create mode
  onClose: () => void;
};

// `created_at` is a timestamptz, so `new Date(iso)` parses it correctly
// directly — unlike `applied_date`, this is NOT the date-only UTC-midnight
// trap `lib/format.ts`'s `parseDateOnly` exists to work around
// (docs/07-component-specifications.md).
function formatAddedDate(createdAt: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
    new Date(createdAt)
  );
}

export function ApplicationFormModal({ isOpen, application, onClose }: ApplicationFormModalProps) {
  const isEditMode = Boolean(application);
  const { show } = useToast();
  const navigate = useNavigate();
  const { create, update } = useApplicationMutations({
    onCreated: () => show('Application added.'),
    onUpdated: () => show('Changes saved.'),
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [duplicate, setDuplicate] = useState<Application | null>(null);
  // Tracks isOpen transitions so the duplicate notice can be cleared during
  // render rather than in the effect below — a direct setState call inside
  // an effect body is exactly the pattern react-hooks/set-state-in-effect
  // exists to catch (docs/03-frontend-architecture.md's recurring gotcha).
  const [lastIsOpen, setLastIsOpen] = useState(isOpen);
  if (isOpen !== lastIsOpen) {
    setLastIsOpen(isOpen);
    if (isOpen) setDuplicate(null);
  }

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    control,
    formState: { errors, isSubmitting, isDirty, dirtyFields },
  } = useForm<ApplicationFormValues>({
    resolver: zodResolver(applicationSchema),
    defaultValues: toFormValues(application),
  });

  // Re-seed the form whenever the target record changes (a different row was
  // opened for edit, or the modal is reopened in create mode). Purely
  // imperative (react-hook-form's own API, not React state), so it stays in
  // the effect rather than joining the render-time adjustment above.
  useEffect(() => {
    if (isOpen) reset(toFormValues(application));
  }, [isOpen, application, reset]);

  // Checked on job-title blur, once both fields are filled — a convenience
  // check, never a blocking one (docs/05 F2). Includes archived rows
  // deliberately: "you already applied and archived it" is exactly the case
  // worth surfacing. Failure is silent — a duplicate check must never stop
  // someone from adding an application.
  const checkForDuplicate = async () => {
    const company = getValues('company_name').trim();
    const title = getValues('job_title').trim();
    if (!company || !title) return;

    try {
      const matches = await findPotentialDuplicates(company, title, application?.id);
      setDuplicate(matches[0] ?? null);
    } catch {
      setDuplicate(null);
    }
  };

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
            <Input
              label="Job title"
              required
              error={errors.job_title?.message}
              {...register('job_title', { onBlur: checkForDuplicate })}
            />
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

          {duplicate && (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-medium">You already have an application for this role.</p>
              <p className="mt-0.5 text-amber-800">
                {duplicate.company_name} · {duplicate.job_title} — added{' '}
                {formatAddedDate(duplicate.created_at)} via {PLATFORM_LABELS[duplicate.platform_source]},
                currently {STATUS_LABELS[duplicate.status]}
              </p>
              <div className="mt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate({ pathname: ROUTES.application(duplicate.id) });
                  }}
                  className="font-medium underline underline-offset-2"
                >
                  View it
                </button>
                <button
                  type="button"
                  onClick={() => setDuplicate(null)}
                  className="font-medium underline underline-offset-2"
                >
                  Add anyway
                </button>
              </div>
            </div>
          )}

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
