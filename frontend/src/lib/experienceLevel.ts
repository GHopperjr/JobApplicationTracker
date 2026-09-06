import type { ExperienceLevel } from '../constants/experienceLevel';
import { parseDateOnly } from './format';

export const FRESH_GRAD_WINDOW_MONTHS = 12;

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// Adds calendar months, clamping the day down when the target month is
// shorter (Jan 31 + 1 month -> Feb 28/29, not a rollover into March) —
// JS's own Date arithmetic rolls over instead of clamping, which would
// silently push the cutoff a day or two later than intended.
function addCalendarMonths(date: Date, months: number): Date {
  const firstOfTargetMonth = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const daysInTargetMonth = new Date(
    firstOfTargetMonth.getFullYear(),
    firstOfTargetMonth.getMonth() + 1,
    0
  ).getDate();
  const day = Math.min(date.getDate(), daysInTargetMonth);
  return new Date(firstOfTargetMonth.getFullYear(), firstOfTargetMonth.getMonth(), day);
}

/**
 * Whole calendar months elapsed since `dateOnly`, floored — for *display*
 * ("6 months since graduating"), not for the fresh-grad/experienced
 * boundary itself (see computeExperienceLevel). A date exactly one year
 * ago returns 12, not 11.99: year/month components are compared directly,
 * with the day of month only as a tiebreaker within the current month, so
 * this never drifts the way day-count-divided-by-30.44 would.
 *
 * Clamped at 0 — a future graduation date has no elapsed months to report.
 */
export function monthsSince(dateOnly: string, now: Date = new Date()): number {
  const d = parseDateOnly(dateOnly);
  let months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) months -= 1;
  return Math.max(months, 0);
}

/**
 * `null` with no graduation date set — no profile, no derived stage, no
 * default filter. Otherwise fresh_grad through a 12-calendar-month window
 * from the graduation date (inclusive of the exact anniversary day, so day
 * 365-ish is still fresh_grad and the day after is experienced), or
 * fresh_grad unconditionally for a future date — not yet graduated but
 * already job hunting is the same postings apply
 * (docs/13-profile-and-experience-filtering.md).
 *
 * Deliberately NOT implemented as `monthsSince(...) <= FRESH_GRAD_WINDOW_MONTHS`:
 * monthsSince floors to whole months, so both "exactly 12 months ago" and
 * "12 months and one day ago" floor to the same 12 and would be
 * indistinguishable — but the two must classify differently. Comparing
 * against an exact cutoff *date* instead gives day-level precision at the
 * boundary that a whole-months count can't.
 */
export function computeExperienceLevel(
  graduationDate: string | null,
  now: Date = new Date()
): ExperienceLevel | null {
  if (!graduationDate) return null;
  const cutoff = addCalendarMonths(parseDateOnly(graduationDate), FRESH_GRAD_WINDOW_MONTHS);
  return startOfLocalDay(now) <= cutoff ? 'fresh_grad' : 'experienced';
}
