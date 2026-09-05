import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useState } from 'react';
import { STATUS_ORDER, type ApplicationStatus } from '../../constants/status';
import { useIsMobile } from '../../hooks/useMediaQuery';
import type { Application } from '../../services/applicationsService';
import { ApplicationCard } from './ApplicationCard';
import { KanbanColumn } from './KanbanColumn';
import { MobileStatusTabs } from './MobileStatusTabs';

type KanbanBoardProps = {
  byStatus: Record<ApplicationStatus, Application[]>;
  isLoading?: boolean;
  onCardClick: (id: string) => void;
  onEdit: (application: Application) => void;
  onDelete: (application: Application) => void;
  onStatusChange: (id: string, status: ApplicationStatus) => void;
  onArchive?: (application: Application) => void;
  staleThresholdDays?: number | null;
  /** When non-empty, columns not in this list are hidden entirely rather
   * than rendered empty (docs/05 F7) — an empty status filter means "show
   * every column", not "show none". */
  statusFilter?: ApplicationStatus[];
};

export function KanbanBoard({
  byStatus,
  isLoading,
  onCardClick,
  onEdit,
  onDelete,
  onStatusChange,
  onArchive,
  staleThresholdDays,
  statusFilter = [],
}: KanbanBoardProps) {
  const isMobile = useIsMobile();
  const [activeApplication, setActiveApplication] = useState<Application | null>(null);

  // 8px activation constraint: without it, every click registers as a
  // micro-drag and clicks/Enter never reach the card (docs/06, Phase 3 traps).
  // coordinateGetter is required — a bare KeyboardSensor only translates the
  // overlay by pixels, it does not move focus between droppables.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const allApplications = STATUS_ORDER.flatMap((status) => byStatus[status]);
  const visibleStatuses = statusFilter.length
    ? STATUS_ORDER.filter((s) => statusFilter.includes(s))
    : STATUS_ORDER;

  const handleDragStart = (event: DragStartEvent) => {
    const application = allApplications.find((a) => a.id === event.active.id);
    setActiveApplication(application ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveApplication(null);
    const { active, over } = event;
    if (!over) return;

    const targetStatus = over.id as ApplicationStatus;
    const application = allApplications.find((a) => a.id === active.id);
    if (!application || application.status === targetStatus) return; // drop on same column: no-op

    onStatusChange(application.id, targetStatus);
  };

  if (isMobile) {
    return (
      <MobileStatusTabs
        byStatus={byStatus}
        isLoading={isLoading}
        onCardClick={onCardClick}
        onEdit={onEdit}
        onDelete={onDelete}
        onStatusChange={onStatusChange}
        onArchive={onArchive}
        staleThresholdDays={staleThresholdDays}
        statusFilter={statusFilter}
      />
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveApplication(null)}
    >
      <div className="flex gap-4 overflow-x-auto px-6 py-4">
        {visibleStatuses.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            applications={byStatus[status]}
            isLoading={isLoading}
            onCardClick={onCardClick}
            onEdit={onEdit}
            onDelete={onDelete}
            onArchive={onArchive}
            staleThresholdDays={staleThresholdDays}
          />
        ))}
      </div>

      <DragOverlay>
        {activeApplication && <ApplicationCard application={activeApplication} isOverlay />}
      </DragOverlay>
    </DndContext>
  );
}
