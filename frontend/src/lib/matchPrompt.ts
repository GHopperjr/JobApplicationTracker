/**
 * Builds the exact prompt sent to Gemini. Pure and testable on its own —
 * a silently malformed prompt is otherwise invisible until a real API call
 * is made (docs/14-ai-match-scoring.md).
 */
export function buildMatchPrompt(resumeText: string, jobDescription: string): string {
  return `You are comparing a candidate's resume against a job description.

Resume:
"""
${resumeText}
"""

Job description:
"""
${jobDescription}
"""

Return a match percentage (0-100) reflecting how well the resume's skills and experience align with
the job description's stated requirements, and a short explanation (2-3 sentences) naming specific
skills or experience that align, and specific gaps.`;
}
