import { Link } from 'react-router-dom';
import type { MetricsPeriod } from '../../constants/metricsPeriod';
import { ROUTES } from '../../constants/routes';
import { computeGoalProgress } from '../../lib/metrics';

type GoalProgressProps = {
  period: MetricsPeriod;
  count: number;
  goal: number | null;
};

/**
 * Only meaningful against This Month — a monthly goal prorated against Last
 * 30 Days is off-by-a-few-days nonsense, and against All Time it's
 * meaningless, so those periods render nothing here at all
 * (docs/12-interview-metrics.md). `goal` is read once at the page level
 * (`useUserPreferences`) rather than here, since MetricsPage's own empty-state
 * branching also needs to know whether a goal is set.
 */
export function GoalProgress({ period, count, goal }: GoalProgressProps) {
  if (period !== 'month') return null;

  if (goal === null) {
    return (
      <p className="text-sm text-slate-500">
        <Link to={ROUTES.settings} className="underline underline-offset-2 hover:text-slate-700">
          Set a monthly goal
        </Link>
      </p>
    );
  }

  // Exceeding a goal shows a full bar and the real numbers (24 of 20) —
  // beating a target should read as beating it, not as capped at 100%.
  const progress = computeGoalProgress(count, goal);

  return (
    <div>
      <p className="text-sm text-slate-700">
        {progress.count} of {progress.goal} applications this month
      </p>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-slate-900" style={{ width: `${progress.barPct}%` }} />
      </div>
    </div>
  );
}
