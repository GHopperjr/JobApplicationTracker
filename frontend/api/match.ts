import { GoogleGenAI, Type } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildMatchPrompt } from '../src/lib/matchPrompt';

// Constructed once per cold start, not per request — GoogleGenAI itself
// does no network call until generateContent runs.
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * The one server-side function in this app (docs/14-ai-match-scoring.md),
 * existing solely to hold GEMINI_API_KEY — a secret that can never reach
 * the browser. Everything else in this app talks to Supabase directly from
 * the client; this function calls nothing in Supabase at all.
 *
 * Never throws past this handler: every failure path responds with a
 * non-2xx status instead, since matchService.ts on the client already
 * treats any non-2xx (or a malformed body) as "no result," not an error to
 * propagate — the same contract geocodingService and routingService use.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { resumeText, jobDescription } = (req.body ?? {}) as {
    resumeText?: unknown;
    jobDescription?: unknown;
  };
  if (typeof resumeText !== 'string' || !resumeText.trim() || typeof jobDescription !== 'string' || !jobDescription.trim()) {
    res.status(400).json({ error: 'resumeText and jobDescription are both required' });
    return;
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: buildMatchPrompt(resumeText, jobDescription),
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            percentage: { type: Type.NUMBER },
            explanation: { type: Type.STRING },
          },
          required: ['percentage', 'explanation'],
        },
      },
    });

    if (!response.text) {
      res.status(502).json({ error: 'Empty response from Gemini' });
      return;
    }

    const result = JSON.parse(response.text) as { percentage?: unknown; explanation?: unknown };
    if (typeof result.percentage !== 'number' || typeof result.explanation !== 'string') {
      res.status(502).json({ error: 'Malformed response from Gemini' });
      return;
    }

    res.status(200).json({ percentage: result.percentage, explanation: result.explanation });
  } catch {
    res.status(502).json({ error: 'Match calculation failed' });
  }
}
