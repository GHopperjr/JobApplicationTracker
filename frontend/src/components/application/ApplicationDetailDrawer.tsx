import { Button } from '../../components/ui/Button';
import { Drawer } from '../../components/ui/Drawer';
import { PLATFORM_LABELS } from '../../constants/platforms';
import { WORK_SETUP_LABELS } from '../../constants/workSetup';
import { formatDate, formatDateTime } from '../../lib/format';
import type { Application } from '../../services/applicationsService';
import { DistanceRow } from './DistanceRow';
import { MatchScore } from './MatchScore';
import { StatusBadge } from './StatusBadge';
import { StatusTimeline } from './StatusTimeline';

type DetailRowProps = { label: string; children: React.ReactNode };

function DetailRow({ label, children }: DetailRowProps) {
  return (
    <div className="flex gap-4 py-1 text-sm">
      <dt className="w-24 shrink-0 text-xs font-medium text-slate-600">{label}</dt>
      <dd className="flex-1 text-slate-900">{children}</dd>
    </div>
  );
}

function shortenUrl(url: string): string {
  const withoutScheme = url.replace(/^https?:\/\//i, '');
  return withoutScheme.length > 40 ? `${withoutScheme.slice(0, 40)}…` : withoutScheme;
}

type ApplicationDetailDrawerProps = {
  isOpen: boolean;
  application: Application | undefined;
  isLoading: boolean;
  onClose: () => void;
  onEdit: (application: Application) => void;
  onDelete: (application: Application) => void;
  onArchive: (application: Application) => void;
};

export function ApplicationDetailDrawer({
  isOpen,
  application,
  isLoading,
  onClose,
  onEdit,
  onDelete,
  onArchive,
}: ApplicationDetailDrawerProps) {
  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={application?.company_name ?? 'Application'}>
      {!application ? (
        <div className="px-4 py-6 text-sm text-slate-600">
          {isLoading ? 'Loading…' : "This application couldn't be found — it may have been deleted or filtered out."}
        </div>
      ) : (
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-200 px-4 py-4">
            <h1 className="text-xl font-semibold text-slate-900">{application.company_name}</h1>
            <p className="text-sm text-slate-600">{application.job_title}</p>
            <div className="mt-2">
              <StatusBadge status={application.status} />
            </div>
          </div>

          <div className="border-b border-slate-200 px-4 py-4">
            <dl>
              <DetailRow label="Platform">{PLATFORM_LABELS[application.platform_source]}</DetailRow>
              {application.location && <DetailRow label="Location">{application.location}</DetailRow>}
              <DistanceRow application={application} />
              {application.work_setup && (
                <DetailRow label="Work setup">{WORK_SETUP_LABELS[application.work_setup]}</DetailRow>
              )}
              {application.interview_scheduled_at && (
                <DetailRow label="Interview">{formatDateTime(application.interview_scheduled_at)}</DetailRow>
              )}
              {application.salary_range && <DetailRow label="Salary">{application.salary_range}</DetailRow>}
              {application.applied_date && (
                <DetailRow label="Applied">{formatDate(application.applied_date)}</DetailRow>
              )}
              {application.job_link && (
                <DetailRow label="Job link">
                  <a
                    href={application.job_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-900 underline underline-offset-2 hover:text-slate-700"
                  >
                    {shortenUrl(application.job_link)} ↗
                  </a>
                </DetailRow>
              )}
            </dl>
          </div>

          {application.notes && (
            <div className="border-b border-slate-200 px-4 py-4">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Notes</h2>
              <p className="whitespace-pre-wrap text-sm text-slate-900">{application.notes}</p>
            </div>
          )}

          <MatchScore application={application} />

          <div className="px-4 py-4">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Timeline</h2>
            <StatusTimeline applicationId={application.id} />
          </div>

          <div className="mt-auto flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
            <Button variant="secondary" onClick={() => onEdit(application)}>
              Edit
            </Button>
            <Button variant="secondary" onClick={() => onArchive(application)}>
              {application.is_archived ? 'Restore' : 'Archive'}
            </Button>
            <Button variant="destructive" onClick={() => onDelete(application)}>
              Delete
            </Button>
          </div>
        </div>
      )}
    </Drawer>
  );
}
