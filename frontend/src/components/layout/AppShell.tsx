import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useApplicationFilters } from '../../hooks/useApplicationFilters';
import { useApplicationForm } from '../../hooks/useApplicationForm';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/Button';
import { DropdownMenu } from '../ui/DropdownMenu';
import { ViewToggle } from './ViewToggle';

export function AppShell() {
  const { user, signOut } = useAuth();
  const { openCreate } = useApplicationForm();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const { view, setView } = useApplicationFilters();

  const handleSignOut = async () => {
    setMenuOpen(false);
    // Order matters: clear the cache only after sign-out resolves, or an
    // in-flight refetch can repopulate it — the cross-user cache leak
    // described in docs/05-features-and-workflows.md F1.
    await signOut();
    queryClient.clear();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
        <h1 className="text-xl font-semibold text-slate-900">Applications</h1>

        <ViewToggle view={view} onChange={setView} />

        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={openCreate}>
            + Add Application
          </Button>

          <div>
            <button
              ref={menuTriggerRef}
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              className="flex h-11 max-w-[160px] items-center truncate rounded-md px-2 text-sm text-slate-600 transition-colors duration-100 hover:bg-slate-100 sm:h-auto sm:py-1"
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
        </div>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  );
}
