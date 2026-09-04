import { useDroppable } from '@dnd-kit/core';
import { Skeleton } from '../../components/ui/Skeleton';
import { STATUS_LABELS, type ApplicationStatus } from '../../constants/status';
import { cn } from '../../lib/cn';
import type { Application } from '../../services/applicationsService';
import { ApplicationCard } from './ApplicationCard';

type KanbanColumnProps = {
  status: ApplicationStatus;
  applications: Application[];
  isLoading?: boolean;
  onCardClick: (id: string) => void;
};

export function KanbanColumn({ status, applications, isLoading, onCardClick }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: isLoading });

  return (
    <div className="flex w-80 shrink-0 flex-col">
      <div className="flex items-baseline gap-2 px-1 pb-2">
        <h2 className="text-sm font-semibold text-slate-900">{STATUS_LABELS[status]}</h2>
        <span className="text-xs text-slate-500">{applications.length}</span>
      </div>
      <div className="mb-2 border-b border-slate-200" />

      <div
        ref={setNodeRef}
        data-testid={`column-${status}`}
        className={cn(
          'flex min-h-[120px] flex-1 flex-col gap-2 rounded-md p-1 transition-colors duration-100',
          isOver && 'bg-slate-100'
        )}
      >
        {isLoading ? (
          <Skeleton variant="card" count={3} />
        ) : applications.length === 0 ? (
          <p className="px-2 py-1 text-xs text-slate-500">Nothing here yet.</p>
        ) : (
          applications.map((application) => (
            <ApplicationCard key={application.id} application={application} onView={onCardClick} />
          ))
        )}
      </div>
    </div>
  );
}
