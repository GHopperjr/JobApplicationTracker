// The one place this pattern is defined — reused by the Zod schema
// (lib/validation.ts) and CSV import coercion (lib/csv.ts) so "what counts
// as a valid job link" can't drift between the form and the importer.
export const HTTP_URL_PATTERN = /^https?:\/\//i;

// Bare domains ("www.linkedin.com/jobs/1") are common paste-ins. Silently
// correcting them is friendlier than erroring on a fixable mistake. Shared
// between the application form (on blur) and CSV import (per-row coercion,
// docs/10-data-import-export.md) so the two never drift apart.
export function autoPrefixUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || HTTP_URL_PATTERN.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
