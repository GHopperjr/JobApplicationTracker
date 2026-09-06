// `applied_date` is a Postgres `date`, returned as "2026-09-01". Parsing it
// with `new Date("2026-09-01")` reads it as UTC midnight, which renders as
// the previous day anywhere west of UTC. Date-only values must be parsed as
// local. This trap does NOT apply to timestamptz columns (created_at,
// updated_at, status_changed_at, changed_at) — those parse correctly with
// `new Date(...)` directly.
//
// Exported: `graduation_date` (docs/13-profile-and-experience-filtering.md)
// is the second date-only column in the app and reuses this rather than
// introducing a second parsing path.
export function parseDateOnly(iso: string): Date {
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

// `<input type="datetime-local">`'s own value shape ("2026-09-10T14:30"),
// which has no timezone — parsed as local time by spec, exactly right for a
// specific meeting time. Distinct from the date-only trap above: that one
// exists because a *date-only* string parses as UTC midnight; a
// datetime-local string has no such gotcha. Converting through
// `new Date(...).toISOString()` here, once, is what keeps a value typed in
// the browser's local timezone from being reinterpreted in whatever
// timezone Postgres's session happens to be in (docs/01-database-schema.md:
// "interview times are inherently timezone-sensitive").
export function fromDatetimeLocalValue(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

export function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
