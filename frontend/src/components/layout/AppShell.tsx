import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export function AppShell() {
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);

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

        {/* ViewToggle and "Add Application" slots land here in later phases. */}

        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="max-w-[160px] truncate rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
          >
            {user?.email}
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-1 w-36 rounded-md border border-slate-200 bg-white py-1 shadow-lg"
            >
              <button
                type="button"
                role="menuitem"
                onClick={handleSignOut}
                className="block w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  );
}
