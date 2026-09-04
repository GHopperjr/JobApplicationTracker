import { useRef, useState } from 'react';
import { DropdownMenu } from '../../components/ui/DropdownMenu';
import type { Application } from '../../services/applicationsService';

type ApplicationActionsProps = {
  application: Application;
  onEdit: (application: Application) => void;
  /** Expected to trigger a confirmation before actually deleting — the
   * caller (ApplicationsPage) owns that dialog, not this component. */
  onDelete: (application: Application) => void;
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
  className,
}: ApplicationActionsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

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
        className="rounded-md px-2 py-1 text-slate-500 transition-colors duration-100 hover:bg-slate-100 hover:text-slate-700"
      >
        ⋮
      </button>
      <DropdownMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        triggerRef={triggerRef}
        className={className}
      >
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setMenuOpen(false);
            onEdit(application);
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
            onDelete(application);
          }}
          className="block w-full px-3 py-1.5 text-left text-sm text-rose-600 transition-colors duration-100 hover:bg-slate-50"
        >
          Delete
        </button>
      </DropdownMenu>
    </>
  );
}
