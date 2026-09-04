import { useRef, useState } from 'react';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { DropdownMenu } from '../../components/ui/DropdownMenu';
import { PLATFORM_LABELS } from '../../constants/platforms';
import { STATUS_LABELS, STATUS_ORDER, STATUS_STYLES, type ApplicationStatus } from '../../constants/status';
import { WORK_SETUP_LABELS } from '../../constants/workSetup';
import { useApplicationForm } from '../../hooks/useApplicationForm';
import { useApplicationMutations } from '../../hooks/useApplicationMutations';
import { useToast } from '../../hooks/useToast';
import { cn } from '../../lib/cn';
import type { Application } from '../../services/applicationsService';

type TableRowProps = {
  application: Application;
  onRowClick: (id: string) => void;
};

export function TableRow({ application, onRowClick }: TableRowProps) {
  const { openEdit } = useApplicationForm();
  const { show } = useToast();
  const { changeStatus, remove } = useApplicationMutations({
    onDeleted: () => show('Application deleted.'),
    onStatusError: () => show("Couldn't update status. Please try again.", 'error'),
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const style = STATUS_STYLES[application.status];

  return (
    <>
      <tr
        onClick={() => onRowClick(application.id)}
        className="cursor-pointer border-b border-slate-100 transition-colors duration-100 hover:bg-slate-50"
      >
        <td className="px-3 py-2.5 text-sm font-semibold text-slate-900">{application.company_name}</td>
        <td className="px-3 py-2.5 text-sm text-slate-600">{application.job_title}</td>
        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
          <select
            aria-label={`Status for ${application.company_name}`}
            value={application.status}
            onChange={(e) =>
              changeStatus.mutate({ id: application.id, status: e.target.value as ApplicationStatus })
            }
            className={cn(
              'rounded-full border-0 px-2 py-0.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1',
              style.badge
            )}
          >
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </td>
        <td className="px-3 py-2.5 text-sm text-slate-600">{PLATFORM_LABELS[application.platform_source]}</td>
        <td className="px-3 py-2.5 text-sm text-slate-600">{application.location}</td>
        <td className="px-3 py-2.5 text-sm text-slate-600">
          {application.work_setup ? WORK_SETUP_LABELS[application.work_setup] : ''}
        </td>
        <td className="px-3 py-2.5 text-sm text-slate-600 tabular-nums">{application.applied_date}</td>
        <td className="px-3 py-2.5 text-sm text-slate-600">{application.salary_range}</td>
        <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
          <button
            ref={menuTriggerRef}
            type="button"
            aria-label={`Actions for ${application.company_name}`}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            onClick={() => setMenuOpen((open) => !open)}
            className="rounded-md px-2 py-1 text-slate-500 transition-colors duration-100 hover:bg-slate-100 hover:text-slate-700"
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
        </td>
      </tr>

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
