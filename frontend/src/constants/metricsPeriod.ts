export const METRICS_PERIOD_VALUES = ['month', 'last30', 'all'] as const;

export type MetricsPeriod = (typeof METRICS_PERIOD_VALUES)[number];

export const METRICS_PERIOD_LABELS: Record<MetricsPeriod, string> = {
  month: 'This Month',
  last30: 'Last 30 Days',
  all: 'All Time',
};

export const DEFAULT_METRICS_PERIOD: MetricsPeriod = 'month';
