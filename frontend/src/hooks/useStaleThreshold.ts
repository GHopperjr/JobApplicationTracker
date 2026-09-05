import { useState } from 'react';
import { STALE_THRESHOLD_DAYS_DEFAULT, STALE_THRESHOLD_STORAGE_KEY } from '../constants/staleness';

// 'off' is a distinct stored value from "nothing stored yet" — the former
// means the user explicitly disabled stale detection, the latter means the
// default (14 days) applies. Wrapped in try/catch: localStorage can throw in
// some contexts (private browsing), and this preference is not worth an
// error boundary over.
function readStoredThreshold(): number | null {
  try {
    const raw = localStorage.getItem(STALE_THRESHOLD_STORAGE_KEY);
    if (raw === null) return STALE_THRESHOLD_DAYS_DEFAULT;
    if (raw === 'off') return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : STALE_THRESHOLD_DAYS_DEFAULT;
  } catch {
    return STALE_THRESHOLD_DAYS_DEFAULT;
  }
}

// This is the app's only user preference and lives in localStorage rather
// than the database — not worth a table plus RLS policies for one integer
// (docs/03-frontend-architecture.md). It does not sync across devices; that
// is an accepted, honest trade-off.
export function useStaleThreshold() {
  const [thresholdDays, setThresholdDaysState] = useState<number | null>(readStoredThreshold);

  const setThresholdDays = (days: number | null) => {
    try {
      localStorage.setItem(STALE_THRESHOLD_STORAGE_KEY, days === null ? 'off' : String(days));
    } catch {
      // Preference simply won't persist across a reload — not worth surfacing.
    }
    setThresholdDaysState(days);
  };

  return { thresholdDays, setThresholdDays };
}
