import { useRef, useState } from 'react';
import { Skeleton } from '../../components/ui/Skeleton';
import { STATUS_LABELS, STATUS_ORDER, type ApplicationStatus } from '../../constants/status';
import { cn } from '../../lib/cn';
import type { Application } from '../../services/applicationsService';
import { ApplicationCard } from './ApplicationCard';

type MobileStatusTabsProps = {
  byStatus: Record<ApplicationStatus, Application[]>;
  isLoading?: boolean;
  onCardClick: (id: string) => void;
  onEdit: (application: Application) => void;
  onDelete: (application: Application) => void;
  onStatusChange: (id: string, status: ApplicationStatus) => void;
  onArchive?: (application: Application) => void;
  staleThresholdDays?: number | null;
  statusFilter?: ApplicationStatus[];
};

const SWIPE_THRESHOLD_PX = 50;

export function MobileStatusTabs({
  byStatus,
  isLoading,
  onCardClick,
  onEdit,
  onDelete,
  onStatusChange,
  onArchive,
  staleThresholdDays,
  statusFilter = [],
}: MobileStatusTabsProps) {
  const visibleStatuses = statusFilter.length
    ? STATUS_ORDER.filter((s) => statusFilter.includes(s))
    : STATUS_ORDER;
  const [activeStatus, setActiveStatus] = useState<ApplicationStatus>(visibleStatuses[0]);
  const activeIndex = Math.max(visibleStatuses.indexOf(activeStatus), 0);
  const touchStartX = useRef<number | null>(null);

  const goToIndex = (index: number) => {
    const clamped = Math.min(Math.max(index, 0), visibleStatuses.length - 1);
    setActiveStatus(visibleStatuses[clamped]);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
    // Swiping left (negative delta) moves to the next tab, matching the
    // natural "content follows the finger" direction.
    goToIndex(activeIndex + (delta < 0 ? 1 : -1));
  };

  const applications = byStatus[activeStatus] ?? [];

  return (
    <div>
      <div role="tablist" aria-label="Status" className="flex gap-1 overflow-x-auto border-b border-slate-200 px-4">
        {visibleStatuses.map((status) => {
          const isActive = status === activeStatus;
          return (
            <button
              key={status}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveStatus(status)}
              className={cn(
                'min-h-11 shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors duration-100',
                isActive
                  ? 'border-slate-900 font-semibold text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              )}
            >
              {STATUS_LABELS[status]} {byStatus[status]?.length ?? 0}
            </button>
          );
        })}
      </div>

      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="flex flex-col gap-2 px-4 py-3"
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
              onStatusChange={onStatusChange}
              onArchive={onArchive}
              staleThresholdDays={staleThresholdDays}
              showMoveTo
            />
          ))
        )}
      </div>
    </div>
  );
}
