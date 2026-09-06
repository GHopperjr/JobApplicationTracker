import { useNavigate } from 'react-router-dom';
import { FunnelBars } from '../components/metrics/FunnelBars';
import { GoalProgress } from '../components/metrics/GoalProgress';
import { PeriodSelector } from '../components/metrics/PeriodSelector';
import { PlatformBreakdown } from '../components/metrics/PlatformBreakdown';
import { StatusBreakdown } from '../components/metrics/StatusBreakdown';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { ROUTES } from '../constants/routes';
import { useMetrics } from '../hooks/useMetrics';
import { useMetricsPeriod } from '../hooks/useMetricsPeriod';
import { useUserPreferences } from '../hooks/useUserPreferences';

// Composition only — every number here is computed in lib/metrics.ts and
// joined in useMetrics; this page just lays the sections out
// (docs/12-interview-metrics.md).
export function MetricsPage() {
  const { period, setPeriod } = useMetricsPeriod();
  const { cohort, totalApplications, statusBreakdown, funnel, platformBreakdown, isLoading } =
    useMetrics(period);
  const { goal, isLoading: goalLoading } = useUserPreferences();
  const navigate = useNavigate();

  // A cohort of zero with a monthly goal set is a real, motivating state —
  // "0 of 20" — not the generic empty-period message, which would bury the
  // one thing worth showing (docs/12-interview-metrics.md).
  const showGoalOnlyEmptyState = period === 'month' && goal !== null;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-6 py-6 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Interview Metrics</h1>
        <PeriodSelector period={period} onChange={setPeriod} />
      </div>

      {isLoading || goalLoading ? (
        <Skeleton variant="card" count={3} />
      ) : totalApplications === 0 ? (
        // A single empty state, not a page of zeroes — a user with no
        // applications yet sees exactly one clear next step.
        <EmptyState
          message="No applications yet."
          action={{ label: 'Go to Job Applications', onClick: () => navigate(ROUTES.applications) }}
        />
      ) : cohort.length === 0 && showGoalOnlyEmptyState ? (
        <GoalProgress period={period} count={0} goal={goal} />
      ) : cohort.length === 0 ? (
        // There ARE applications, just none in this narrower period — the
        // period selector above is already the way out, so no duplicate
        // action button here. A cohort of zero never reaches a percentage
        // calculation (no status/funnel/platform sections render here).
        <EmptyState message="No applications in this period." />
      ) : (
        <>
          <GoalProgress period={period} count={cohort.length} goal={goal} />
          <StatusBreakdown breakdown={statusBreakdown} />
          <FunnelBars funnel={funnel} />
          <PlatformBreakdown breakdown={platformBreakdown} />
        </>
      )}
    </div>
  );
}
