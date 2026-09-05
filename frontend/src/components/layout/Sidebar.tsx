import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '../../constants/navigation';
import { cn } from '../../lib/cn';

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return cn(
    'block rounded-md px-3 py-2 text-sm transition-colors duration-100',
    isActive
      ? 'bg-slate-100 font-medium text-slate-900'
      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
  );
}

/** The nav list itself, shared by the desktop sidebar and the mobile sheet. */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Sections" className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => (
        <NavLink key={item.to} to={item.to} onClick={onNavigate} className={navLinkClass}>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

/**
 * Sits one level above the Board/Table toggle and does not absorb it: the
 * sidebar switches between pages, ViewToggle switches views within the Job
 * Applications page. Part of the shell rather than any page, so it keeps
 * its scroll position across navigation.
 */
export function Sidebar() {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white px-3 py-4">
      <span className="px-3 pb-4 text-sm font-semibold tracking-tight text-slate-900">
        Job Tracker
      </span>
      <SidebarNav />
    </aside>
  );
}
