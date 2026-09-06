import { useState } from 'react';

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'jat.sidebarCollapsed';

function readStoredCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

// Same reasoning as useStaleThreshold: a single per-device UI preference,
// not worth a database round-trip for. Doesn't sync across devices.
export function useSidebarCollapsed() {
  const [collapsed, setCollapsedState] = useState(readStoredCollapsed);

  const setCollapsed = (value: boolean) => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(value));
    } catch {
      // Preference simply won't persist across a reload — not worth surfacing.
    }
    setCollapsedState(value);
  };

  return { collapsed, setCollapsed };
}
