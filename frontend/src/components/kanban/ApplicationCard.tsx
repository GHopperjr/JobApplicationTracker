import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { memo } from 'react';
import { ApplicationActions } from '../../components/application/ApplicationActions';
import { StaleIndicator } from '../../components/application/StaleIndicator';
import { PLATFORM_LABELS } from '../../constants/platforms';
import type { ApplicationStatus } from '../../constants/status';
import { cn } from '../../lib/cn';
import { formatCardDate } from '../../lib/format';
import type { Application } from '../../services/applicationsService';

type ApplicationCardProps = {
  application: Application;
  /** True only for the copy rendered inside <DragOverlay> — the "flying" card. */
  isOverlay?: boolean;
  /** Omitted for the overlay copy, which never receives interaction. */
  onView?: (id: string) => void;
  onEdit?: (application: Application) => void;
  onDelete?: (application: Application) => void;
  /** "Move to…" — the only status-change path on mobile, where drag is
   * disabled (docs/04-design-system.md). Omitted on desktop. */
  onStatusChange?: (id: string, status: ApplicationStatus) => void;
  showMoveTo?: boolean;
  onArchive?: (application: Application) => void;
  /** null = stale detection turned off; no dot renders either way (docs/05 F10). */
  staleThresholdDays?: number | null;
};

function ApplicationCardImpl({
  application,
  isOverlay = false,
  onView,
  onEdit,
  onDelete,
  onStatusChange,
  showMoveTo = false,
  onArchive,
  staleThresholdDays = null,
}: ApplicationCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: application.id,
    disabled: isOverlay,
  });

  // Pointer drag works from anywhere on the card (the whole card gets the
  // pointer listener); keyboard drag is a separate, explicitly focusable
  // handle — a card can't be both a role="button" that opens on Enter AND
  // the thing @dnd-kit's KeyboardSensor lifts on Space, since that sensor's
  // default trigger keys are Space AND Enter (docs/07-component-specifications.md).
  const { onKeyDown: dragKeyDown, ...pointerListeners } = listeners ?? {};

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  if (isDragging && !isOverlay) {
    // The origin placeholder — the real card is following the pointer
    // inside <DragOverlay> instead.
    return (
      <div
        ref={setNodeRef}
        className="h-[92px] rounded-lg border-2 border-dashed border-slate-200"
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      style={isOverlay ? undefined : style}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          onView?.(application.id);
          return;
        }
        dragKeyDown?.(e as unknown as KeyboardEvent & { currentTarget: EventTarget });
      }}
      onClick={() => onView?.(application.id)}
      {...(isOverlay ? {} : pointerListeners)}
      className={cn(
        'group relative rounded-lg border border-slate-200 bg-white p-3 text-left shadow-sm transition-colors duration-100',
        'hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2',
        isOverlay && 'rotate-1 border-slate-300 shadow-lg opacity-90'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          {...(isOverlay ? {} : attributes)}
          {...(isOverlay ? {} : listeners)}
          tabIndex={isOverlay ? undefined : 0}
          aria-label="Reorder"
          onClick={(e) => e.stopPropagation()}
          className="mr-1 flex h-6 w-6 shrink-0 items-center justify-center cursor-grab text-slate-300 opacity-0 focus:opacity-100 group-hover:opacity-100"
        >
          ⠿
        </span>
        <h3 className="flex-1 truncate text-sm font-semibold text-slate-900">
          {application.company_name}
        </h3>
        {!isOverlay && <StaleIndicator application={application} thresholdDays={staleThresholdDays} />}
        {!isOverlay && onEdit && onDelete && (
          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
            <ApplicationActions
              application={application}
              onEdit={onEdit}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
              showMoveTo={showMoveTo}
              onArchive={onArchive}
              className="w-40 text-left"
            />
          </div>
        )}
      </div>

      <p className="truncate text-sm text-slate-600">{application.job_title}</p>

      <div className="mt-2 flex items-center gap-2 truncate text-xs text-slate-500">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
        <span className="truncate">{PLATFORM_LABELS[application.platform_source]}</span>
        {application.salary_range && <span className="truncate">{application.salary_range}</span>}
        {application.applied_date && <span>{formatCardDate(application.applied_date)}</span>}
      </div>
    </div>
  );
}

// DndContext re-renders frequently during a drag (every pointer move
// re-evaluates active/over state); a custom comparator keeps that cheap for
// every card that isn't the one actually being dragged. This only pays off
// because onView/onEdit/onDelete are stabilized with useCallback at their
// origin (ApplicationsPage) — without that, every render would produce new
// callback references and defeat the comparison anyway.
export const ApplicationCard = memo(ApplicationCardImpl, (prev, next) => {
  return (
    prev.application.id === next.application.id &&
    prev.application.updated_at === next.application.updated_at &&
    prev.isOverlay === next.isOverlay &&
    prev.onView === next.onView &&
    prev.onEdit === next.onEdit &&
    prev.onDelete === next.onDelete &&
    prev.onStatusChange === next.onStatusChange &&
    prev.showMoveTo === next.showMoveTo &&
    prev.onArchive === next.onArchive &&
    prev.staleThresholdDays === next.staleThresholdDays
  );
});
