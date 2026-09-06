export type MatchResult = {
  percentage: number;
  explanation: string;
};

/**
 * The one client call to `/api/match`. Returns `null` on any failure —
 * non-200, network error, or a malformed body — rather than throwing,
 * mirroring `geocodingService` and `routingService` from doc 11: this
 * enhances a view, it isn't a write that should be allowed to fail loudly
 * and block something else (docs/14-ai-match-scoring.md).
 */
export async function calculateMatch(
  resumeText: string,
  jobDescription: string
): Promise<MatchResult | null> {
  try {
    const response = await fetch('/api/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumeText, jobDescription }),
    });
    if (!response.ok) return null;

    const data = (await response.json()) as { percentage?: unknown; explanation?: unknown };
    if (typeof data.percentage !== 'number' || typeof data.explanation !== 'string') return null;

    return { percentage: data.percentage, explanation: data.explanation };
  } catch {
    return null;
  }
}
