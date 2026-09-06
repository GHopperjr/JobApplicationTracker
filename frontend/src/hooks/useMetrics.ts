import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { MetricsPeriod } from '../constants/metricsPeriod';
import {
  computeFunnel,
  computePlatformBreakdown,
  computeStatusBreakdown,
  filterCohort,
} from '../lib/metrics';
import { listStatusHistory } from '../services/statusHistoryService';
import { queryKeys } from './queryKeys';
import { useApplications } from './useApplications';

/**
 * Joins the cohort-filtered applications and the status-history query, then
 * memoizes every derived metric over that one cohort so the status
 * snapshot, funnel, and platform breakdown can never disagree about what
 * "the data" means (docs/12-interview-metrics.md). Includes archived
 * applications — an application archived after being rejected still
 * happened, and the funnel is a historical accounting, not a view of what's
 * currently active on the board.
 */
export function useMetrics(period: MetricsPeriod) {
  const { applications, isLoading: applicationsLoading } = useApplications({ archived: 'all' });
  const historyQuery = useQuery({
    queryKey: queryKeys.statusHistory.all,
    queryFn: listStatusHistory,
  });
  const history = useMemo(() => historyQuery.data ?? [], [historyQuery.data]);

  const cohort = useMemo(() => filterCohort(applications, period), [applications, period]);
  const statusBreakdown = useMemo(() => computeStatusBreakdown(cohort), [cohort]);
  const funnel = useMemo(() => computeFunnel(cohort, history), [cohort, history]);
  const platformBreakdown = useMemo(
    () => computePlatformBreakdown(cohort, history),
    [cohort, history]
  );

  return {
    cohort,
    totalApplications: applications.length,
    statusBreakdown,
    funnel,
    platformBreakdown,
    isLoading: applicationsLoading || historyQuery.isLoading,
  };
}
