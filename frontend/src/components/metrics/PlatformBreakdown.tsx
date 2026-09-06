import { PLATFORM_LABELS } from '../../constants/platforms';
import type { PlatformBreakdownEntry } from '../../lib/metrics';

type PlatformBreakdownProps = {
  breakdown: PlatformBreakdownEntry[];
};

export function PlatformBreakdown({ breakdown }: PlatformBreakdownProps) {
  return (
    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
      {breakdown.map((entry) => (
        <li key={entry.platform} className="px-4 py-2.5 text-sm text-slate-700">
          <span className="font-medium text-slate-900">{PLATFORM_LABELS[entry.platform]}</span>
          {'  '}
          {entry.applied} applied · {entry.reachedInterviewPct}% reached interview
        </li>
      ))}
    </ul>
  );
}
