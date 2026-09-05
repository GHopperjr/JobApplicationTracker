// `applied_date` is a Postgres `date`, returned as "2026-09-01". Parsing it
// with `new Date("2026-09-01")` reads it as UTC midnight, which renders as
// the previous day anywhere west of UTC. Date-only values must be parsed as
// local. This trap does NOT apply to timestamptz columns (created_at,
// updated_at, status_changed_at, changed_at) — those parse correctly with
// `new Date(...)` directly.
function parseDateOnly(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// 'Sep 1' — card meta row, current year only.
export function formatCardDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
    parseDateOnly(iso)
  );
}

// 'Sep 1, 2026' — table cells, drawer detail rows.
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parseDateOnly(iso));
}

// 'Sep 3, 2:15 PM' — status timeline entries only. Timestamps are
// timestamptz, so `new Date(...)` parses them correctly without the
// date-only trap above.
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

// 'Sep 1' — the timestamptz-safe sibling of formatCardDate, for columns like
// created_at where `new Date(iso)` is the correct parse (not parseDateOnly).
export function formatShortTimestamp(iso: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(iso));
}
