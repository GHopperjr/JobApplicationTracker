import { useState } from 'react';
import type { ApplicationStatus } from '../constants/status';
import { getSkippedStages } from '../lib/statusPipeline';
import type { Application } from '../services/applicationsService';

type PendingChange = {
  kind: 'single' | 'bulk';
  ids: string[];
  to: ApplicationStatus;
  skippedStages: ApplicationStatus[];
};

type ChangeStatusFn = (
  id: string,
  status: ApplicationStatus,
  interviewScheduledAt?: string | null
) => void;
type BulkChangeStatusFn = (
  ids: string[],
  status: ApplicationStatus,
  interviewScheduledAt?: string | null
) => void;

/**
 * The single interception point for every status-change path in the app
 * (Kanban drag, table/mobile inline select, "Move to…", bulk actions) — all
 * of them already funnel into one `onStatusChange`/bulk callback in
 * ApplicationsPage, so this wraps those two rather than touching each
 * component that triggers a change.
 *
 * Two independent gates, checked in order:
 * 1. Does this move skip a pipeline stage (see lib/statusPipeline)? If so,
 *    hold the change and surface it via `skipConfirm` until the caller
 *    renders a confirmation and the user accepts or cancels.
 * 2. Does this move land on "Scheduled for Interview"? If so, hold the
 *    change and surface it via `scheduleModalOpen` so the caller can prompt
 *    for a date — optional, per docs/05: skipping it still moves the card,
 *    just without setting `interview_scheduled_at`, leaving whatever was
 *    there (nothing, on a first move) untouched.
 *
 * A move that clears both gates commits immediately with no modal at all —
 * this is the common case (adjacent forward moves, corrections, moving to
 * Rejected) and must stay exactly as fast as before this guard existed.
 */
export function useStatusChangeGuard({
  applications,
  onChangeStatus,
  onBulkChangeStatus,
}: {
  applications: Application[];
  onChangeStatus: ChangeStatusFn;
  onBulkChangeStatus: BulkChangeStatusFn;
}) {
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [awaitingSchedule, setAwaitingSchedule] = useState(false);

  const commit = (change: PendingChange, interviewScheduledAt: string | null | undefined) => {
    if (change.kind === 'single') onChangeStatus(change.ids[0], change.to, interviewScheduledAt);
    else onBulkChangeStatus(change.ids, change.to, interviewScheduledAt);
    setPending(null);
    setAwaitingSchedule(false);
  };

  const proceedPastSkipCheck = (change: PendingChange) => {
    if (change.to === 'scheduled_for_interview') {
      setPending(change);
      setAwaitingSchedule(true);
    } else {
      commit(change, undefined);
    }
  };

  const beginChange = (kind: 'single' | 'bulk', ids: string[], to: ApplicationStatus) => {
    const selected = applications.filter((a) => ids.includes(a.id));
    const skippedStages = Array.from(
      new Set(selected.flatMap((a) => getSkippedStages(a.status, to)))
    );
    const change: PendingChange = { kind, ids, to, skippedStages };
    if (skippedStages.length > 0) {
      setPending(change);
    } else {
      proceedPastSkipCheck(change);
    }
  };

  const scheduleInitialValue =
    pending?.kind === 'single'
      ? (applications.find((a) => a.id === pending.ids[0])?.interview_scheduled_at ?? null)
      : null;

  return {
    requestStatusChange: (id: string, to: ApplicationStatus) => beginChange('single', [id], to),
    requestBulkStatusChange: (ids: string[], to: ApplicationStatus) =>
      beginChange('bulk', ids, to),

    skipConfirm:
      pending && !awaitingSchedule
        ? { skippedStages: pending.skippedStages, count: pending.ids.length }
        : null,
    confirmSkip: () => pending && proceedPastSkipCheck(pending),
    cancelSkip: () => setPending(null),

    scheduleModalOpen: awaitingSchedule,
    scheduleInitialValue,
    saveSchedule: (interviewScheduledAt: string | null) =>
      pending && commit(pending, interviewScheduledAt),
    skipSchedule: () => pending && commit(pending, undefined),
    closeSchedule: () => {
      setPending(null);
      setAwaitingSchedule(false);
    },
  };
}
