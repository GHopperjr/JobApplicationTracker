import { afterEach, describe, expect, it, vi } from 'vitest';
import { calculateMatch } from './matchService';

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(implementation: () => Promise<unknown> | never) {
  const fetchMock = vi.fn(implementation);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('calculateMatch', () => {
  it('posts resumeText and jobDescription to /api/match', async () => {
    const fetchMock = stubFetch(async () => ({
      ok: true,
      json: async () => ({ percentage: 70, explanation: 'Decent match' }),
    }));

    await calculateMatch('my resume', 'the job description');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/match',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ resumeText: 'my resume', jobDescription: 'the job description' }),
      })
    );
  });

  it('returns the parsed percentage and explanation on success', async () => {
    stubFetch(async () => ({
      ok: true,
      json: async () => ({ percentage: 91, explanation: 'Excellent alignment' }),
    }));

    await expect(calculateMatch('resume', 'job')).resolves.toEqual({
      percentage: 91,
      explanation: 'Excellent alignment',
    });
  });

  it('returns null on a non-200 response rather than throwing', async () => {
    stubFetch(async () => ({ ok: false, json: async () => ({}) }));
    await expect(calculateMatch('resume', 'job')).resolves.toBeNull();
  });

  it('returns null when the network rejects rather than throwing', async () => {
    stubFetch(async () => {
      throw new Error('network down');
    });
    await expect(calculateMatch('resume', 'job')).resolves.toBeNull();
  });

  it('returns null on a malformed body missing the expected fields', async () => {
    stubFetch(async () => ({ ok: true, json: async () => ({ unexpected: true }) }));
    await expect(calculateMatch('resume', 'job')).resolves.toBeNull();
  });
});
