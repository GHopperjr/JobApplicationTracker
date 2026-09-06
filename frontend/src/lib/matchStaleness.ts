/**
 * A match is stale exactly when `match_calculated_at` predates either the
 * resume's upload or the application's own last update (which already
 * changes whenever `job_description` is edited, since it's a column on
 * that same row — no separate flag to keep in sync by hand)
 * (docs/14-ai-match-scoring.md). No cached match at all is not "stale" —
 * there's nothing to be stale about, just nothing calculated yet.
 */
export function isMatchStale(
  matchCalculatedAt: string | null,
  resumeUploadedAt: string | null,
  applicationUpdatedAt: string
): boolean {
  if (!matchCalculatedAt) return false;
  const calculated = new Date(matchCalculatedAt).getTime();
  if (resumeUploadedAt && new Date(resumeUploadedAt).getTime() > calculated) return true;
  return new Date(applicationUpdatedAt).getTime() > calculated;
}
