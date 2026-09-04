import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { memo, useRef, useState } from 'react';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { DropdownMenu } from '../../components/ui/DropdownMenu';
import { PLATFORM_LABELS } from '../../constants/platforms';
import { useApplicationForm } from '../../hooks/useApplicationForm';
import { useApplicationMutations } from '../../hooks/useApplicationMutations';
import { useToast } from '../../hooks/useToast';
import { cn } from '../../lib/cn';
import { formatCardDate } from '../../lib/format';
import type { Application } from '../../services/applicationsService';

type ApplicationCardProps = {
  application: Application;
  /** True only for the copy rendered inside <DragOverlay> — the "flying" card. */
  isOverlay?: boolean;
  /** Omitted for the overlay copy, which never receives interaction. */
  onView?: (id: string) => void;
};

function ApplicationCardImpl({ application, isOverlay = false, onView }: ApplicationCardProps) {
  const { openEdit } = useApplicationForm();
  const { show } = useToast();
  const { remove } = useApplicationMutations({
    onDeleted: () => show('Application deleted.'),
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

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
    <>
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
            className="mr-1 shrink-0 cursor-grab text-slate-300 opacity-0 focus:opacity-100 group-hover:opacity-100"
          >
            ⠿
          </span>
          <h3 className="flex-1 truncate text-sm font-semibold text-slate-900">
            {application.company_name}
          </h3>
          <div className="shrink-0">
            <button
              ref={menuTriggerRef}
              type="button"
              aria-label={`Actions for ${application.company_name}`}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((open) => !open);
              }}
              className="rounded-md px-1.5 py-0.5 text-slate-500 transition-colors duration-100 hover:bg-slate-100 hover:text-slate-700"
            >
              ⋮
            </button>
            <DropdownMenu
              isOpen={menuOpen}
              onClose={() => setMenuOpen(false)}
              triggerRef={menuTriggerRef}
              className="w-32 text-left"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  openEdit(application);
                }}
                className="block w-full px-3 py-1.5 text-left text-sm text-slate-700 transition-colors duration-100 hover:bg-slate-50"
              >
                Edit
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setDeleteConfirmOpen(true);
                }}
                className="block w-full px-3 py-1.5 text-left text-sm text-rose-600 transition-colors duration-100 hover:bg-slate-50"
              >
                Delete
              </button>
            </DropdownMenu>
          </div>
        </div>

        <p className="truncate text-sm text-slate-600">{application.job_title}</p>

        <div className="mt-2 flex items-center gap-2 truncate text-xs text-slate-500">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
          <span className="truncate">{PLATFORM_LABELS[application.platform_source]}</span>
          {application.salary_range && <span className="truncate">{application.salary_range}</span>}
          {application.applied_date && <span>{formatCardDate(application.applied_date)}</span>}
        </div>
      </div>

      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        title="Delete application"
        message={`Delete the application for ${application.job_title} at ${application.company_name}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          setDeleteConfirmOpen(false);
          remove.mutate(application.id);
        }}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </>
  );
}

// DndContext re-renders frequently during a drag (every pointer move
// re-evaluates active/over state); memoizing keeps that cheap for every
// card that isn't the one actually being dragged.
export const ApplicationCard = memo(ApplicationCardImpl);
