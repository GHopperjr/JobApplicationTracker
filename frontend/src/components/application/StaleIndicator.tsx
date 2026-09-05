import { daysSinceStatusChange, isStale } from '../../constants/staleness';
import type { Application } from '../../services/applicationsService';

type StaleIndicatorProps = {
  application: Application;
  thresholdDays: number | null;
};

// A single, restrained marker — no border, no background tint, no row
// highlight. In a slow job search most applications eventually go stale, and
// a treatment loud enough to notice on one card becomes a wall of amber
// across twenty, communicating nothing (docs/04-design-system.md).
export function StaleIndicator({ application, thresholdDays }: StaleIndicatorProps) {
  if (thresholdDays === null || !isStale(application, thresholdDays)) return null;

  const label = `No change in ${daysSinceStatusChange(application.status_changed_at)} days.`;

  return (
    <span
      className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
      title={label}
      aria-label={label}
      role="img"
    />
  );
}
