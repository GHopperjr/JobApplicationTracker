import { describe, expect, it } from 'vitest';
import { buildMatchPrompt } from './matchPrompt.js';

// A snapshot-style test, per docs/14-ai-match-scoring.md: a silently
// malformed prompt (a dropped variable, a missing instruction) is otherwise
// invisible until a real, quota-spending API call is made.
describe('buildMatchPrompt', () => {
  it('includes both texts verbatim', () => {
    const prompt = buildMatchPrompt('Senior React developer, 5 years', 'Looking for a React expert');

    expect(prompt).toContain('Senior React developer, 5 years');
    expect(prompt).toContain('Looking for a React expert');
  });

  it('asks for a percentage and a specific, gap-naming explanation', () => {
    const prompt = buildMatchPrompt('resume text', 'job text');

    expect(prompt).toMatch(/match percentage/i);
    expect(prompt).toMatch(/0-100/);
    expect(prompt).toMatch(/specific\s+skills or experience/i);
    expect(prompt).toMatch(/specific gaps/i);
  });
});
