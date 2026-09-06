import { motion } from 'motion/react';
import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '../../constants/navigation';
import { useMotionDuration } from '../../hooks/useMotionDuration';
import { useSidebarCollapsed } from '../../hooks/useSidebarCollapsed';
import { cn } from '../../lib/cn';

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return cn(
    'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors duration-100',
    isActive
      ? 'bg-slate-100 font-medium text-slate-900'
      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
  );
}

/**
 * The nav list itself, shared by the desktop sidebar and the mobile sheet.
 * `collapsed` only ever comes from the desktop `Sidebar` — the mobile sheet
 * is already full-width, so collapsing it would serve no purpose.
 */
export function SidebarNav({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  return (
    <nav aria-label="Sections" className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={navLinkClass}
          title={collapsed ? item.label : undefined}
        >
          {collapsed ? (
            <span aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center text-sm font-semibold">
              {item.label[0]}
            </span>
          ) : (
            <span className="truncate">{item.label}</span>
          )}
          {collapsed && <span className="sr-only">{item.label}</span>}
        </NavLink>
      ))}
    </nav>
  );
}

const EXPANDED_WIDTH = 224;
const COLLAPSED_WIDTH = 64;

/**
 * Sits one level above the Board/Table toggle and does not absorb it: the
 * sidebar switches between pages, ViewToggle switches views within the Job
 * Applications page. Part of the shell rather than any page, so it keeps
 * its scroll position across navigation.
 *
 * Collapse state is per-device (docs/11-navigation-and-distance.md) and
 * persists across reloads via useSidebarCollapsed, the same
 * localStorage-preference pattern as useStaleThreshold.
 */
export function Sidebar() {
  const { collapsed, setCollapsed } = useSidebarCollapsed();
  const duration = useMotionDuration(0.2);

  return (
    <motion.aside
      animate={{ width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH }}
      transition={{ duration, ease: 'easeInOut' }}
      className="flex shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white px-3 py-4"
    >
      <div className="mb-2 flex items-center justify-between gap-1 px-1">
        {!collapsed && (
          <span className="truncate text-sm font-semibold tracking-tight text-slate-900">
            Job Tracker
          </span>
        )}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors duration-100 hover:bg-slate-100 hover:text-slate-700"
        >
          {collapsed ? '›' : '‹'}
        </button>
      </div>
      <SidebarNav collapsed={collapsed} />
    </motion.aside>
  );
}
