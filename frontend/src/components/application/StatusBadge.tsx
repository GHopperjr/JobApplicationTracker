import { STATUS_LABELS, STATUS_STYLES, type ApplicationStatus } from '../../constants/status';

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={`inline-block shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${style.badge}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
