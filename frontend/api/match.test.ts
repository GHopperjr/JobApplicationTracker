import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describe, expect, it, vi } from 'vitest';

const generateContent = vi.fn();
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
  Type: { OBJECT: 'OBJECT', NUMBER: 'NUMBER', STRING: 'STRING' },
}));

const { default: handler } = await import('./match.js');

function makeReq(body: unknown, method = 'POST'): VercelRequest {
  return { method, body } as unknown as VercelRequest;
}

function makeRes(): VercelResponse {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res as unknown as VercelResponse;
}

describe('POST /api/match', () => {
  it('rejects non-POST methods', async () => {
    const res = makeRes();
    await handler(makeReq({}, 'GET'), res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('rejects a request missing resumeText or jobDescription', async () => {
    const res = makeRes();
    await handler(makeReq({ resumeText: '', jobDescription: 'job' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('returns the structured percentage and explanation on success', async () => {
    generateContent.mockResolvedValue({
      text: JSON.stringify({ percentage: 82, explanation: 'Strong match on React and TypeScript.' }),
    });
    const res = makeRes();

    await handler(makeReq({ resumeText: 'resume', jobDescription: 'job' }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      percentage: 82,
      explanation: 'Strong match on React and TypeScript.',
    });
  });

  it('passes the model name and structured response config to Gemini', async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify({ percentage: 50, explanation: 'x' }) });
    const res = makeRes();

    await handler(makeReq({ resumeText: 'resume', jobDescription: 'job' }), res);

    expect(generateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gemini-3.1-flash-lite',
        config: expect.objectContaining({ responseMimeType: 'application/json' }),
      })
    );
  });

  it('returns 502 when the Gemini call itself throws', async () => {
    generateContent.mockRejectedValue(new Error('Gemini is down'));
    const res = makeRes();

    await handler(makeReq({ resumeText: 'resume', jobDescription: 'job' }), res);

    expect(res.status).toHaveBeenCalledWith(502);
  });

  it('returns 502 on malformed (non-JSON) text from Gemini', async () => {
    generateContent.mockResolvedValue({ text: 'not valid json' });
    const res = makeRes();

    await handler(makeReq({ resumeText: 'resume', jobDescription: 'job' }), res);

    expect(res.status).toHaveBeenCalledWith(502);
  });

  it('returns 502 when the parsed response is missing the expected fields', async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify({ unexpected: true }) });
    const res = makeRes();

    await handler(makeReq({ resumeText: 'resume', jobDescription: 'job' }), res);

    expect(res.status).toHaveBeenCalledWith(502);
  });
});
