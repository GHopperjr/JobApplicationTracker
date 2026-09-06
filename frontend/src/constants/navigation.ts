import { ROUTES } from './routes';

/**
 * The sidebar's sections, in one array — adding Archive later is a one-line
 * change in one file rather than an edit in three places
 * (docs/11-navigation-and-distance.md).
 *
 * "Job Applications", not "Applications" — the latter reads as "apps" in a
 * product that also runs on mobile and the web.
 */
export const NAV_ITEMS: { to: string; label: string }[] = [
  { to: ROUTES.applications, label: 'Job Applications' },
  { to: ROUTES.settings, label: 'Settings' },
  { to: ROUTES.metrics, label: 'Interview Metrics' },
];
