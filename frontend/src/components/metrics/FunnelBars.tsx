import type { FunnelStage } from '../../lib/metrics';

type FunnelBarsProps = {
  funnel: FunnelStage[];
};

// Numeric cards and CSS bars only, no charting library — the data is too
// sparse for one to reveal anything a number doesn't (docs/12-interview-
// metrics.md).
export function FunnelBars({ funnel }: FunnelBarsProps) {
  return (
    <div className="space-y-2">
      {funnel.map((stage) => (
        <div key={stage.label} className="flex items-center gap-3 text-sm">
          <span className="w-40 shrink-0 truncate text-slate-600">{stage.label}</span>
          <span className="w-8 shrink-0 text-right font-medium text-slate-900">{stage.count}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-slate-900"
              style={{ width: `${stage.pct ?? 0}%` }}
            />
          </div>
          <span className="w-10 shrink-0 text-right text-xs text-slate-500">{stage.pct ?? 0}%</span>
        </div>
      ))}
    </div>
  );
}
