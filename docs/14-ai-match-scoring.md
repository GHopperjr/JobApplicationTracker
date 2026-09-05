# 14 — AI Resume ↔ Job Match Scoring

The fourth and most speculative post-roadmap feature, after [11](./11-navigation-and-distance.md),
[12](./12-interview-metrics.md), and [13](./13-profile-and-experience-filtering.md). It compares a
stored resume against a job description and returns a percentage match with a short explanation.

**This document exists because the original idea was infeasible as stated, and it records what
survived contact with that fact.** The original proposal was: given an application's job-posting
link, fetch and read the posting, and compare it to a resume the user uploads. Two of those three
pieces don't survive scrutiny in their original form — read *Why this isn't what was proposed*
before anything else, because the scope here is deliberately narrower than the original ask, for
reasons that don't go away if reconsidered later.

---

## Why this isn't what was proposed

### Fetching the job posting's own link doesn't work

This app has no custom server — every existing feature runs client-side against Supabase or a
public API designed for cross-origin use (docs 11's Nominatim and OSRM calls). **A browser cannot
fetch arbitrary third-party pages.** Job boards don't set the CORS headers that would let this
app's page read their content, so a `fetch()` to a stored `job_link` fails before any parsing logic
would even run.

Working around this would need a server-side fetch proxy — and even with one, many postings
(LinkedIn chief among them) are JavaScript-rendered, sit behind a login wall, or actively block
scraping per their own terms of service. That combination — new server infrastructure, plus a
non-trivial share of postings still failing regardless — was rejected as not worth building.

**What replaces it:** the user pastes the job description text directly into the application form,
the same way they already type in the company name and job title. This isn't a workaround; it's the
better design. The user reading a posting and typing what it says is more reliable than any scraper
this app could write, for every site, with no exceptions and no maintenance burden when a job board
changes its markup.

### The match cannot be computed without a paid API call, even though everything else here is free

Docs 11–13 all hold to a zero-cost constraint. This feature cannot: a meaningful "how well does this
resume match this posting" comparison requires actual language understanding, which means an LLM
call, which is the one thing in this entire feature set that costs money to run.

**What survives:** Gemini's free tier (Google's `gemini-2.0-flash` or newer) rather than a paid
model. It genuinely costs nothing at this app's volume — a personal job search produces, at most, a
few dozen match requests ever, nowhere near the free tier's rate limits. This is the sole exception
to zero-cost in the entire post-roadmap set, and it is a free-tier exception, not a paid one.

### A secret key changes the architecture, regardless of which LLM or which fetch approach was chosen

This is the one consequence that doesn't depend on any of the choices above. **Any LLM API needs a
key, and a key can never be shipped to the browser** — anyone could read it out of the Network tab
and spend the app owner's quota. This is categorically different from Nominatim and OSRM, which need
no key at all.

**What this means concretely:** doc 14 introduces this app's first custom server-side code —
one small function, described below — for the single narrow purpose of holding a secret. Nothing
else about "Supabase is the backend" ([02](./02-backend-architecture.md)) changes; this is a
one-function exception with a stated, non-negotiable reason, not a shift toward a general backend.

---

## Scope

**In scope:**

- Uploading one resume (PDF or DOCX), with its text extracted client-side.
- Pasting a job description into the application form (optional, like every other detail field).
- An on-demand, cached match: a percentage plus a short explanation of what aligns and what's
  missing.

**Explicitly not in scope:**

- **Fetching `job_link` automatically.** See above. The field stays exactly what it is today — a
  URL the user can click to revisit the posting — and gains no new behavior.
- **Multiple resumes.** One resume, replaced on re-upload. A tailored-resume-per-application system
  is a real possible future, but it changes the data model (a resume becomes a list, not a row) and
  isn't designed here.
- **Automatic or background matching.** Every match is a result of the user clicking a button for
  one specific application. Nothing runs on save, on a schedule, or in the background.
- **Any general-purpose backend.** The serverless function below does exactly one thing. It is not
  the start of a broader backend for this app.

---

## Data model

Extending `user_preferences` (from [12](./12-interview-metrics.md)) with the resume, and
`applications` with the job description and the cached match:

```sql
alter table public.user_preferences
  add column resume_storage_path text,
  add column resume_filename     text,
  add column resume_text         text,
  add column resume_uploaded_at  timestamptz;

alter table public.applications
  add column job_description     text,
  add column match_percentage    integer check (match_percentage between 0 and 100),
  add column match_explanation   text,
  add column match_calculated_at timestamptz;
```

**`resume_text` is what actually gets matched — `resume_storage_path` is only for letting the user
re-download what they uploaded.** The two are populated together at upload time and never diverge:
there is no path where a stored file exists without its extracted text, or vice versa.

**Every new column is nullable, and every feature in this document is invisible in their absence** —
the same graceful-absence rule 11 and 13 already establish. No resume, no match button anywhere. No
job description, no match button on that specific application, even with a resume on file.

### Storage

```sql
insert into storage.buckets (id, name, public) values ('resumes', 'resumes', false);

create policy "Users can manage their own resume"
  on storage.objects for all
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
```

One bucket, not public, objects stored under a `{user_id}/` prefix. The policy is the storage
equivalent of every RLS predicate elsewhere in this app: a user reaches only their own folder,
enforced by the database rather than trusted to application code.

### Staleness is derived, never stored as its own flag

A match is stale exactly when `match_calculated_at` predates either `resume_uploaded_at` or the
application's own `updated_at` (which already changes whenever `job_description` is edited, since
it's a column on that same row — no new timestamp needed). The drawer computes this on render; there
is no `is_stale` column to keep in sync by hand.

---

## Extraction — client-side, lazy-loaded

`pdf.js` (PDF) and `mammoth.js` (DOCX) run entirely in the browser at upload time. Both are loaded
via dynamic `import()`, only when the Settings page's uploader is actually opened:

```ts
async function extractResumeText(file: File): Promise<string> {
  if (file.type === 'application/pdf') {
    const { getDocument } = await import('pdfjs-dist');
    // … page-by-page text extraction
  }
  const { extractRawText } = await import('mammoth');
  // … .docx path
}
```

**This is not optional polish — it's the fix for a problem the build has already flagged once.**
`vite build`'s own output warns that the main bundle exceeds 500 kB
([06](./06-implementation-roadmap.md) never needed to address this, since nothing before this
feature was large enough to matter). `pdf.js` alone is a meaningfully sized library that exactly one
page needs; loading it eagerly for every visitor makes that warning worse for a capability most
sessions never touch. Dynamic import keeps it out of the bundle every other page pays for.

Extraction happens once, at upload, and the result is what's stored. Nothing re-parses the file
later — every subsequent read is the `resume_text` column.

---

## The one server-side function

```
POST /api/match
Body: { resumeText: string, jobDescription: string }
Response: { percentage: number, explanation: string }
```

```ts
// api/match.ts — Vercel serverless function
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { resumeText, jobDescription } = req.body;

  const result = await callGemini({
    apiKey: process.env.GEMINI_API_KEY,   // server-only — no VITE_ prefix, never bundled
    prompt: buildMatchPrompt(resumeText, jobDescription),
    responseSchema: { percentage: 'number', explanation: 'string' },
  });

  res.json(result);
}
```

**Structured output, not free-form text to parse.** Gemini supports a JSON response schema; the
function asks for exactly `{ percentage, explanation }` and returns that directly. There is no
regex hunting for a number inside a paragraph, and no failure mode where the model phrases its
answer in a way the client can't parse.

**`GEMINI_API_KEY` deliberately has no `VITE_` prefix** — every existing environment variable in
this app *is* `VITE_`-prefixed specifically because Vite inlines those into the client bundle
([09](./09-operations.md)). This is the first variable in the project where that would be the wrong
choice: it must stay server-only, readable only inside the Vercel function's own runtime, never
reaching `import.meta.env` in the browser at all.

### Why a Vercel function rather than a Supabase Edge Function

The frontend already deploys to Vercel with git-based auto-deploy. A file under `api/` is
automatically a serverless function on that same deployment, using the same environment-variable
system already in place, with no second platform, no second deploy step, and no new CLI to learn.
Supabase Edge Functions would work too, but would add a parallel deployment pipeline for one
function, with no offsetting benefit — this app's data still lives entirely in Supabase, and this
function calls nothing there.

### `vercel.json`'s rewrite must not shadow `/api/*`

`vercel.json`'s existing SPA rewrite (`"source": "/(.*)"` → `/index.html`) is unconditional as
written. Vercel resolves serverless functions before rewrites, so `/api/match` is expected to reach
the function rather than the SPA fallback — **but this must be verified against a real deployment
once the function exists**, not assumed from the config alone, since it is the first time this
project has had any path that isn't purely a client-side route.

---

## The prompt

```
You are comparing a candidate's resume against a job description.

Resume:
"""
{resumeText}
"""

Job description:
"""
{jobDescription}
"""

Return a match percentage (0-100) reflecting how well the resume's skills and experience align with
the job description's stated requirements, and a short explanation (2-3 sentences) naming specific
skills or experience that align, and specific gaps.
```

**The explanation must name specifics, not a mood.** "Strong alignment on React and TypeScript; no
mentioned Kubernetes experience" is a sentence someone can act on. "This is a decent match" is not,
and a prompt that doesn't ask for specifics tends to produce exactly that.

---

## User interface

### Settings → Resume

- Upload / replace, showing the current filename and upload date once one exists.
- The privacy note, stated plainly and visible at the point of upload, not buried in a separate
  policy page: **"Your resume's text is sent to Google's Gemini API to calculate match scores."**
  This app has been deliberate about privacy everywhere else — Sentry strips salary figures and
  company names from error reports, sign-in errors are vague enough to avoid leaking whether an
  account exists — and silently sending someone's resume to a third party would be the one
  inconsistent thing in this codebase. Saying so plainly is the fix.

### Application form

One new optional field, grouped with the other optional details: paste the job description. Never
required — the fast-add guarantee from [06](./06-implementation-roadmap.md) ("add an application in
under 15 seconds") applies here exactly as it did to doc 13's target-audience field.

### Detail Drawer

- **"Calculate Match"** button, shown only when both a resume and a job description exist for that
  application. Absent otherwise — no disabled button, no explanatory placeholder, just not there.
- While the request is in flight: a loading state, not a blocking one — the rest of the drawer stays
  usable.
- Once calculated: the percentage and explanation, cached, shown on every future open with no
  re-computation and no quota spent — until either side changes, at which point a small
  "Resume or description updated since this was calculated" note appears next to a **Recalculate**
  option.
- **A failed call** (Gemini down, rate-limited, network error) shows an inline "Couldn't calculate
  a match — try again" and leaves any previously cached result untouched. A failure never corrupts
  or clears a result that already existed.

---

## Code structure

| File | Responsibility |
|---|---|
| `api/match.ts` | The one serverless function. Calls Gemini, returns structured JSON. Nothing else lives here |
| `lib/resumeExtraction.ts` | `extractResumeText(file)` — the two dynamic-import parsing paths |
| `services/resumeService.ts` | Upload to Storage, update `user_preferences`, delete/replace |
| `services/matchService.ts` | The one client call to `/api/match`; returns `{ percentage, explanation } \| null`, never throws |
| `hooks/useResume.ts` | Query + mutation for the stored resume |
| `hooks/useMatchScore.ts` | Triggers a match, writes the cached result via the existing applications service, exposes staleness |
| `components/settings/ResumeUpload.tsx` | Settings UI |
| `components/application/MatchScore.tsx` | The drawer's button / result / stale-notice states |

**`matchService.ts` returns `null` on failure rather than throwing, mirroring `geocodingService`
and `routingService` from doc 11** — the same reasoning applies: this is a feature that enhances a
view, not a write that can be allowed to fail loudly and block something else.

---

## Testing

Extending [08](./08-testing-and-ci.md).

**Unit:**

- Staleness logic: `match_calculated_at` before `resume_uploaded_at` → stale; before the
  application's `updated_at` → stale; after both → fresh.
- The prompt-building function includes both texts verbatim and asks for the structured schema —
  a snapshot-style test, since a silently malformed prompt is otherwise invisible until a real API
  call is made.

**Service (mocked fetch):**

- A successful `/api/match` response returns `{ percentage, explanation }`.
- A non-200 response, a timeout, and a malformed JSON body all return `null` rather than throwing.
- `resumeService` upload writes both the Storage object and the `user_preferences` row together —
  not one without the other.

**Component:**

- The "Calculate Match" button does not render when either the resume or the job description is
  missing.
- The stale notice appears when `resume_uploaded_at` is newer than `match_calculated_at`, and not
  otherwise.
- A failed match shows the inline error and leaves a previously-cached result visible and unchanged.

**What does not get an automated test:** the actual Gemini call. Grading response *quality* — is an
83% score reasonable, does the explanation actually name real skills — isn't something a CI
assertion can meaningfully check, and mocking the call (as the service tests above already do)
covers everything about *this app's* handling of the response. Judging whether the match itself is
good is a manual, occasional check, not a suite.

**Non-negotiable, in [08](./08-testing-and-ci.md)'s sense:**

> **A failed match call must never overwrite or clear a previously cached result.** Cache a match,
> mock the next call to fail, and assert the original percentage and explanation are still exactly
> what they were. Without this, a transient Gemini outage would silently erase a result the user
> already had and trusted.

---

## Traps

- **Do not attempt to fetch `job_link`.** This was the original idea and it is why this document
  exists in its current, narrower form. Revisiting it means re-litigating the CORS and ToS
  constraints above, not implementing something that was merely deferred.
- **`GEMINI_API_KEY` must never carry the `VITE_` prefix.** That prefix is precisely Vite's signal
  to inline a variable into the client bundle — the one thing this key must never do.
- **The match result is cached; recomputation is never automatic.** An automatic re-run on every
  drawer open would spend free-tier quota on applications nobody is currently looking at.
- **A failed API call must not touch a previously cached result.** See the non-negotiable test.
- **`resume_text` and `resume_storage_path` are set together, always.** A resume record with a file
  but no extracted text (or vice versa) is a state this design does not account for and the UI does
  not know how to render.
- **Verify `/api/match` actually resolves in production, not just locally.** This is the first
  non-SPA route this project has ever had; `vercel.json`'s catch-all rewrite is expected not to
  shadow it, but "expected" is not the same as "confirmed against a real deployment."

---

This closes the four-feature post-roadmap set: 11 (navigation + distance), 12 (interview metrics),
13 (profile + experience filtering), 14 (this document). All four remain gated on the existing
roadmap ([06](./06-implementation-roadmap.md)) shipping first.
