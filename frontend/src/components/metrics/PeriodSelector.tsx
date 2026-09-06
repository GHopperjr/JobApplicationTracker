import {
  METRICS_PERIOD_LABELS,
  METRICS_PERIOD_VALUES,
  type MetricsPeriod,
} from '../../constants/metricsPeriod';
import { SegmentedToggle } from '../ui/SegmentedToggle';

type PeriodSelectorProps = {
  period: MetricsPeriod;
  onChange: (period: MetricsPeriod) => void;
};

const OPTIONS = METRICS_PERIOD_VALUES.map((value) => ({
  value,
  label: METRICS_PERIOD_LABELS[value],
}));

// Reuses the same pill control as the Board/Table toggle and the login
// page's sign-in/sign-up switch — three options instead of two, no new UI
// idiom (docs/12-interview-metrics.md).
export function PeriodSelector({ period, onChange }: PeriodSelectorProps) {
  return <SegmentedToggle ariaLabel="Period" options={OPTIONS} value={period} onChange={onChange} />;
}
