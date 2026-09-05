import { useDroppable } from '@dnd-kit/core';
import { Skeleton } from '../../components/ui/Skeleton';
import { STATUS_LABELS, STATUS_STYLES, type ApplicationStatus } from '../../constants/status';
import { cn } from '../../lib/cn';
import type { Application } from '../../services/applicationsService';
import { ApplicationCard } from './ApplicationCard';

type KanbanColumnProps = {
  status: ApplicationStatus;
  applications: Application[];
  isLoading?: boolean;
  onCardClick: (id: string) => void;
  onEdit: (application: Application) => void;
  onDelete: (application: Application) => void;
  onArchive?: (application: Application) => void;
  staleThresholdDays?: number | null;
};

export function KanbanColumn({
  status,
  applications,
  isLoading,
  onCardClick,
  onEdit,
  onDelete,
  onArchive,
  staleThresholdDays,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: isLoading });
  const style = STATUS_STYLES[status];

  return (
    <div className="flex w-80 shrink-0 flex-col">
      <div className="flex items-center gap-2 px-1 pb-2">
        <span className={cn('h-2 w-2 shrink-0 rounded-full ring-4', style.dot, style.ring)} />
        <h2 className="text-sm font-semibold tracking-tight text-slate-900">
          {STATUS_LABELS[status]}
        </h2>
        <span className="text-xs font-medium text-slate-500">{applications.length}</span>
      </div>
      <div className={cn('mb-2 border-b-2', style.headerBorder)} />

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
            <ApplicationCard
              key={application.id}
              application={application}
              onView={onCardClick}
              onEdit={onEdit}
              onDelete={onDelete}
              onArchive={onArchive}
              staleThresholdDays={staleThresholdDays}
            />
          ))
        )}
      </div>
    </div>
  );
}
