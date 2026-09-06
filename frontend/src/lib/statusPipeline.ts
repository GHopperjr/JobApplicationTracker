import type { ApplicationStatus } from '../constants/status';

// Depth order for skip detection only — distinct from STATUS_ORDER (the
// Kanban column order), which also includes 'rejected'. Rejected is an
// outcome reachable from any depth, not a position in it, so it's excluded
// here entirely: moving to or from Rejected is never a "skip."
const PIPELINE_STAGES: readonly ApplicationStatus[] = [
  'pending_application',
  'scheduled_for_interview',
  'interviewed',
  'accepted',
];

/**
 * The stage(s) skipped by moving from `from` to `to`, or `[]` if nothing is
 * skipped. Only ever non-empty for a *forward* move within the pipeline
 * stages above — a backward move (correcting a mistake) never skips
 * anything, and a move into or out of Rejected is always allowed with no
 * confirmation, since Rejected isn't a pipeline depth to skip past.
 */
export function getSkippedStages(
  from: ApplicationStatus,
  to: ApplicationStatus
): ApplicationStatus[] {
  const fromIndex = PIPELINE_STAGES.indexOf(from);
  const toIndex = PIPELINE_STAGES.indexOf(to);
  if (fromIndex === -1 || toIndex === -1) return [];
  if (toIndex <= fromIndex + 1) return [];
  return PIPELINE_STAGES.slice(fromIndex + 1, toIndex);
}
