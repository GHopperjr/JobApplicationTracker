import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { useApplicationFilters } from '../../hooks/useApplicationFilters';
import { useApplicationForm } from '../../hooks/useApplicationForm';
import { useAuth } from '../../hooks/useAuth';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { Button } from '../ui/Button';
import { Drawer } from '../ui/Drawer';
import { DropdownMenu } from '../ui/DropdownMenu';
import { OfflineBanner } from './OfflineBanner';
import { Sidebar, SidebarNav } from './Sidebar';
import { ViewToggle } from './ViewToggle';

export function AppShell() {
  const { user, signOut } = useAuth();
  const { openCreate } = useApplicationForm();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const { view, setView, filters } = useApplicationFilters();
  const isMobile = useIsMobile();
  const { pathname } = useLocation();

  // The header's view toggle and Add button belong to the Job Applications
  // page, not the shell — Settings shares this header and has neither.
  const isApplicationsPage = pathname.startsWith(ROUTES.applications);
  const title = isApplicationsPage ? 'Job Applications' : 'Settings';
  // The archive view is table-only (docs/05 F9) — a Kanban board of
  // applications that aren't in the pipeline is a contradiction, so the
  // toggle that would switch to it is hidden rather than disabled.
  const showViewToggle = isApplicationsPage && filters.archived !== 'archived';

  const handleSignOut = async () => {
    setMenuOpen(false);
    // Order matters: clear the cache only after sign-out resolves, or an
    // in-flight refetch can repopulate it — the cross-user cache leak
    // described in docs/05-features-and-workflows.md F1.
    await signOut();
    queryClient.clear();
  };

  // The one place color is used purely for identity rather than status or
  // platform meaning — reserved to this badge alone so it never competes
  // with either palette (docs/04-design-system.md).
  const initials = (user?.email?.split('@')[0] ?? '').slice(0, 2).toUpperCase();

  const accountMenu = (
    <div>
      <button
        ref={menuTriggerRef}
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        className="flex h-11 max-w-[130px] items-center gap-2 truncate rounded-md px-2 text-sm text-slate-600 transition-colors duration-100 hover:bg-slate-100 sm:h-auto sm:max-w-[190px] sm:py-1"
      >
        <span
          aria-hidden="true"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-indigo-200 bg-indigo-50 text-xs font-semibold text-indigo-700"
        >
          {initials}
        </span>
        <span className="truncate">{user?.email}</span>
      </button>
      <DropdownMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        triggerRef={menuTriggerRef}
        className="w-36"
      >
        <button
          type="button"
          role="menuitem"
          onClick={handleSignOut}
          className="flex h-11 w-full items-center px-3 text-left text-sm text-slate-700 transition-colors duration-100 hover:bg-slate-50 sm:h-auto sm:py-1.5"
        >
          Sign out
        </button>
      </DropdownMenu>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Below 768px a persistent sidebar would eat half the screen, so the
          nav moves into the same bottom-sheet Drawer every other overlay in
          this app uses on mobile (docs/11-navigation-and-distance.md). */}
      {!isMobile && <Sidebar />}

      {/* min-w-0 overrides a flex item's default min-width: auto — without
          it, this column refuses to shrink below its widest descendant's
          natural width (the Kanban board's un-scrolled column set), so the
          whole column — header included — grows past the viewport instead
          of the board's own overflow-x-auto ever getting a chance to
          scroll internally. */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-md">
          {isMobile ? (
            <div className="flex flex-col gap-2 px-4 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setNavOpen(true)}
                    aria-label="Open navigation"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
                  >
                    ☰
                  </button>
                  <h1 className="truncate text-lg font-semibold text-slate-900">{title}</h1>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {isApplicationsPage && (
                    <Button
                      variant="primary"
                      onClick={openCreate}
                      aria-label="Add application"
                      className="w-11 px-0 text-base"
                    >
                      +
                    </Button>
                  )}
                  {accountMenu}
                </div>
              </div>
              {showViewToggle && <ViewToggle view={view} onChange={setView} />}
            </div>
          ) : (
            <div className="flex h-14 items-center justify-between px-6">
              <h1 className="text-xl font-semibold text-slate-900">{title}</h1>

              {showViewToggle ? (
                <ViewToggle view={view} onChange={setView} />
              ) : (
                isApplicationsPage && (
                  <span className="text-sm font-medium text-slate-600">Archive</span>
                )
              )}

              <div className="flex items-center gap-3">
                {isApplicationsPage && (
                  <Button variant="primary" onClick={openCreate}>
                    + Add Application
                  </Button>
                )}
                {accountMenu}
              </div>
            </div>
          )}
          <OfflineBanner />
        </header>

        <main>
          <Outlet />
        </main>
      </div>

      <Drawer isOpen={navOpen} onClose={() => setNavOpen(false)} title="Menu">
        <div className="px-3 py-3">
          <SidebarNav onNavigate={() => setNavOpen(false)} />
        </div>
      </Drawer>
    </div>
  );
}
