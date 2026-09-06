import { STATUS_LABELS, STATUS_STYLES } from '../../constants/status';
import type { StatusBreakdownEntry } from '../../lib/metrics';

type StatusBreakdownProps = {
  breakdown: StatusBreakdownEntry[];
};

// Reuses STATUS_STYLES' dot colour — a status looks the same here as it
// does on a card, a badge, and a column header (docs/12-interview-metrics.md).
export function StatusBreakdown({ breakdown }: StatusBreakdownProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {breakdown.map((entry) => (
        <div key={entry.status} className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_STYLES[entry.status].dot}`} />
            <span className="truncate text-xs font-medium text-slate-600">
              {STATUS_LABELS[entry.status]}
            </span>
          </div>
          <p className="mt-1 text-lg font-semibold text-slate-900">{entry.count}</p>
          <p className="text-xs text-slate-400">{entry.pct ?? 0}%</p>
        </div>
      ))}
    </div>
  );
}
