import { useRef, useState } from 'react';
import { DropdownMenu } from '../../components/ui/DropdownMenu';
import { STATUS_LABELS, STATUS_ORDER, type ApplicationStatus } from '../../constants/status';
import type { Application } from '../../services/applicationsService';

type ApplicationActionsProps = {
  application: Application;
  onEdit: (application: Application) => void;
  /** Expected to trigger a confirmation before actually deleting — the
   * caller (ApplicationsPage) owns that dialog, not this component. */
  onDelete: (application: Application) => void;
  /** "Move to…" is the only status-change path on mobile, where drag is
   * disabled (docs/04-design-system.md). */
  onStatusChange?: (id: string, status: ApplicationStatus) => void;
  showMoveTo?: boolean;
  className?: string;
};

/**
 * Shared "⋮" menu used by both ApplicationCard and TableRow, so the two can
 * never drift into offering different actions for the same record
 * (docs/07-component-specifications.md).
 */
export function ApplicationActions({
  application,
  onEdit,
  onDelete,
  onStatusChange,
  showMoveTo = false,
  className,
}: ApplicationActionsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [moveToOpen, setMoveToOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const closeAll = () => {
    setMenuOpen(false);
    setMoveToOpen(false);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Actions for ${application.company_name}`}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen((open) => !open);
        }}
        className="flex h-11 w-11 items-center justify-center rounded-md text-slate-500 transition-colors duration-100 hover:bg-slate-100 hover:text-slate-700 sm:h-auto sm:w-auto sm:px-2 sm:py-1"
      >
        ⋮
      </button>
      <DropdownMenu isOpen={menuOpen} onClose={closeAll} triggerRef={triggerRef} className={className}>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            closeAll();
            onEdit(application);
          }}
          className="block min-h-11 w-full px-3 py-1.5 text-left text-sm text-slate-700 transition-colors duration-100 hover:bg-slate-50"
        >
          Edit
        </button>

        {showMoveTo && onStatusChange && (
          <>
            <button
              type="button"
              role="menuitem"
              aria-expanded={moveToOpen}
              onClick={() => setMoveToOpen((open) => !open)}
              className="flex min-h-11 w-full items-center justify-between px-3 py-1.5 text-left text-sm text-slate-700 transition-colors duration-100 hover:bg-slate-50"
            >
              Move to
              <span aria-hidden="true">▸</span>
            </button>
            {moveToOpen && (
              <div className="border-y border-slate-100 bg-slate-50 py-1">
                {STATUS_ORDER.filter((s) => s !== application.status).map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      closeAll();
                      onStatusChange(application.id, s);
                    }}
                    className="block min-h-11 w-full px-5 py-1.5 text-left text-sm text-slate-700 transition-colors duration-100 hover:bg-slate-100"
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        <button
          type="button"
          role="menuitem"
          onClick={() => {
            closeAll();
            onDelete(application);
          }}
          className="block min-h-11 w-full px-3 py-1.5 text-left text-sm text-rose-600 transition-colors duration-100 hover:bg-slate-50"
        >
          Delete
        </button>
      </DropdownMenu>
    </>
  );
}
