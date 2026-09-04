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
import { useApplicationMutations } from '../../hooks/useApplicationMutations';
import { useToast } from '../../hooks/useToast';
import type { Application } from '../../services/applicationsService';
import { ApplicationCard } from './ApplicationCard';
import { KanbanColumn } from './KanbanColumn';

type KanbanBoardProps = {
  byStatus: Record<ApplicationStatus, Application[]>;
  isLoading?: boolean;
};

export function KanbanBoard({ byStatus, isLoading }: KanbanBoardProps) {
  const { show } = useToast();
  const { changeStatus } = useApplicationMutations({
    onStatusError: () => show("Couldn't update status. Please try again.", 'error'),
  });
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

    changeStatus.mutate({ id: application.id, status: targetStatus });
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveApplication(null)}
    >
      <div className="flex gap-4 overflow-x-auto px-6 py-4">
        {STATUS_ORDER.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            applications={byStatus[status]}
            isLoading={isLoading}
          />
        ))}
      </div>

      <DragOverlay>
        {activeApplication && <ApplicationCard application={activeApplication} isOverlay />}
      </DragOverlay>
    </DndContext>
  );
}
