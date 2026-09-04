import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useApplicationFilters } from '../../hooks/useApplicationFilters';
import { useApplicationForm } from '../../hooks/useApplicationForm';
import { useAuth } from '../../hooks/useAuth';
import { useIsMobile } from '../../hooks/useMediaQuery';
import { Button } from '../ui/Button';
import { DropdownMenu } from '../ui/DropdownMenu';
import { OfflineBanner } from './OfflineBanner';
import { ViewToggle } from './ViewToggle';

export function AppShell() {
  const { user, signOut } = useAuth();
  const { openCreate } = useApplicationForm();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const { view, setView } = useApplicationFilters();
  const isMobile = useIsMobile();

  const handleSignOut = async () => {
    setMenuOpen(false);
    // Order matters: clear the cache only after sign-out resolves, or an
    // in-flight refetch can repopulate it — the cross-user cache leak
    // described in docs/05-features-and-workflows.md F1.
    await signOut();
    queryClient.clear();
  };

  const accountMenu = (
    <div>
      <button
        ref={menuTriggerRef}
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        className="flex h-11 max-w-[90px] items-center truncate rounded-md px-2 text-sm text-slate-600 transition-colors duration-100 hover:bg-slate-100 sm:h-auto sm:max-w-[160px] sm:py-1"
      >
        {user?.email}
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
    <div className="min-h-screen bg-slate-50">
      {/* Wraps to two rows below 768px — title + icon-only Add on the first,
          ViewToggle full-width on the second — rather than shrinking every
          control until it's unreadable (docs/07-component-specifications.md). */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        {isMobile ? (
          <div className="flex flex-col gap-2 px-4 py-2">
            <div className="flex items-center justify-between gap-2">
              <h1 className="text-lg font-semibold text-slate-900">Applications</h1>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="primary"
                  onClick={openCreate}
                  aria-label="Add application"
                  className="w-11 px-0 text-base"
                >
                  +
                </Button>
                {accountMenu}
              </div>
            </div>
            <ViewToggle view={view} onChange={setView} />
          </div>
        ) : (
          <div className="flex h-14 items-center justify-between px-6">
            <h1 className="text-xl font-semibold text-slate-900">Applications</h1>

            <ViewToggle view={view} onChange={setView} />

            <div className="flex items-center gap-3">
              <Button variant="primary" onClick={openCreate}>
                + Add Application
              </Button>
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
  );
}
