import type { ApplicationStatus } from '../constants/status';
import type { PlatformSource } from '../constants/platforms';
import type { WorkSetup } from '../constants/workSetup';
import { toDatetimeLocalValue } from '../lib/format';
import type { Application } from '../services/applicationsService';

// The form's shape differs from the row: no id/user_id/timestamps, and
// optional text fields are '' rather than null while the form is being edited.
export type ApplicationFormValues = {
  company_name: string;
  job_title: string;
  platform_source: PlatformSource;
  status: ApplicationStatus;
  job_link: string;
  salary_range: string;
  location: string;
  work_setup: WorkSetup | '';
  applied_date: string;
  notes: string;
  // datetime-local's own value shape, not the stored ISO string — converted
  // back to one at submission (fromDatetimeLocalValue), the same as
  // ScheduleInterviewModal.
  interview_scheduled_at: string;
};

// Local calendar date, not UTC — new Date().toISOString() would roll back a
// day for anyone west of UTC late in the evening (the same trap documented
// for parsing `applied_date` back out for display).
function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export const toFormValues = (app?: Application): ApplicationFormValues => ({
  company_name: app?.company_name ?? '',
  job_title: app?.job_title ?? '',
  platform_source: app?.platform_source ?? 'jobstreet',
  status: app?.status ?? 'pending_application',
  job_link: app?.job_link ?? '',
  salary_range: app?.salary_range ?? '',
  location: app?.location ?? '',
  work_setup: app?.work_setup ?? '',
  applied_date: app?.applied_date ?? todayISO(),
  notes: app?.notes ?? '',
  interview_scheduled_at: toDatetimeLocalValue(app?.interview_scheduled_at ?? null),
});
