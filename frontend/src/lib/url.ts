// Bare domains ("www.linkedin.com/jobs/1") are common paste-ins. Silently
// correcting them is friendlier than erroring on a fixable mistake. Shared
// between the application form (on blur) and CSV import (per-row coercion,
// docs/10-data-import-export.md) so the two never drift apart.
export function autoPrefixUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || /^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
