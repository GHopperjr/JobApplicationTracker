import { motion } from 'motion/react';
import type { ComponentType } from 'react';
import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '../../constants/navigation';
import { ROUTES } from '../../constants/routes';
import { useMotionDuration } from '../../hooks/useMotionDuration';
import { useSidebarCollapsed } from '../../hooks/useSidebarCollapsed';
import { cn } from '../../lib/cn';
import { ApplicationsIcon, MetricsIcon, SettingsIcon } from './NavIcons';

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return cn(
    'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors duration-100',
    isActive
      ? 'bg-slate-100 font-medium text-slate-900'
      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
  );
}

// Keyed by route rather than folded into NAV_ITEMS itself — that array is
// plain data (constants/navigation.ts has no React dependency), and an
// icon is a render concern that belongs at this layer instead.
const NAV_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  [ROUTES.applications]: ApplicationsIcon,
  [ROUTES.settings]: SettingsIcon,
  [ROUTES.metrics]: MetricsIcon,
};

/**
 * The nav list itself, shared by the desktop sidebar and the mobile sheet.
 * `collapsed` only ever comes from the desktop `Sidebar` — the mobile sheet
 * is already full-width, so collapsing it would serve no purpose. The icon
 * shows in both states; collapsed, it's the only thing left once the label
 * hides.
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
      {NAV_ITEMS.map((item) => {
        const Icon = NAV_ICONS[item.to];
        return (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={navLinkClass}
            title={collapsed ? item.label : undefined}
          >
            <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
            {collapsed ? (
              <span className="sr-only">{item.label}</span>
            ) : (
              <span className="truncate">{item.label}</span>
            )}
          </NavLink>
        );
      })}
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
