import { useSearchParams } from 'react-router-dom';
import {
  DEFAULT_METRICS_PERIOD,
  METRICS_PERIOD_VALUES,
  type MetricsPeriod,
} from '../constants/metricsPeriod';

/**
 * `?period=` lives in the URL, the same state-location rule
 * useApplicationFilters gives `?status=` — validated, not cast, so a
 * hand-edited `?period=bogus` falls back to the default instead of flowing
 * into a cohort filter that silently matches nothing (docs/12-interview-
 * metrics.md).
 */
export function useMetricsPeriod() {
  const [searchParams, setSearchParams] = useSearchParams();

  const raw = searchParams.get('period');
  const period: MetricsPeriod = METRICS_PERIOD_VALUES.includes(raw as MetricsPeriod)
    ? (raw as MetricsPeriod)
    : DEFAULT_METRICS_PERIOD;

  const setPeriod = (next: MetricsPeriod) => {
    const params = new URLSearchParams(searchParams);
    // The default is omitted rather than written into every shared URL.
    if (next === DEFAULT_METRICS_PERIOD) params.delete('period');
    else params.set('period', next);
    setSearchParams(params, { replace: true });
  };

  return { period, setPeriod };
}
