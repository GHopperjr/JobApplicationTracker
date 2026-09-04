import { STATUS_LABELS } from '../../constants/status';
import { useStatusHistory } from '../../hooks/useStatusHistory';
import { formatDateTime } from '../../lib/format';

export function StatusTimeline({ applicationId }: { applicationId: string }) {
  const { history, isLoading } = useStatusHistory(applicationId);

  if (isLoading) {
    return <p className="text-xs text-slate-500">Loading…</p>;
  }

  if (history.length === 0) {
    return null;
  }

  return (
    <ul className="space-y-2">
      {history.map((entry) => (
        <li key={entry.id} className="flex items-baseline gap-2 text-sm">
          <span className="text-slate-400">●</span>
          <span className="flex-1 text-slate-900">{STATUS_LABELS[entry.to_status]}</span>
          <span className="text-xs text-slate-500">{formatDateTime(entry.changed_at)}</span>
        </li>
      ))}
    </ul>
  );
}
