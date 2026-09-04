# 10 — Data Import & Export

## Why this exists

**Nobody starts this app with zero applications.** Anyone who needs a job tracker has already been
tracking somehow — a spreadsheet, a Notes file, a Trello board. Asking them to hand-enter twenty
existing applications before the tool becomes useful is the single largest adoption barrier, and it
happens at the worst possible moment: before they've seen any value.

Export is the inverse obligation. This is someone's job-search history, and "how do I get my data
out" should never require asking the developer.

Both are one-shot flows a user touches rarely. They are built to be *correct and legible*, not fast
or clever.

---

## Dependencies

```
papaparse @types/papaparse
```

CSV is deceptively hard — quoted fields containing commas, escaped quotes, `\r\n` vs `\n`, a UTF-8
BOM that Excel writes and that turns the first header into `﻿Company`. Hand-rolling
`split(',')` fails on the first export from Excel. Papaparse handles all of it, is ~45KB, and is
lazy-loaded (below) so it costs nothing to users who never import.

---

# Part 1 — Export

## Scope

Exports **exactly what the user is currently looking at**: the same filters, the same sort, the same
archived scope. If the table shows 12 filtered rows, the export has 12 rows in that order. This is
the least surprising behavior and needs no separate UI to explain.

An "Export all" option sits beside it for the full unfiltered set.

## Entry point

Filter bar overflow menu → **Export CSV** / **Export all as CSV**. Not a primary button — this is a
rare action and does not deserve permanent header real estate ([04](./04-design-system.md)).

## Columns

Exported in this order, with human-readable headers — the file should be legible in Excel, not a
database dump:

| Header | Source | Notes |
|---|---|---|
| `Company` | `company_name` | |
| `Job Title` | `job_title` | |
| `Status` | `status` | **Display label**, e.g. `Scheduled for Interview` — not `scheduled_for_interview` |
| `Platform` | `platform_source` | Display label, e.g. `JobStreet` |
| `Location` | `location` | Empty string when null |
| `Salary Range` | `salary_range` | Verbatim; it is free text |
| `Applied Date` | `applied_date` | `YYYY-MM-DD`, unambiguous across locales |
| `Job Link` | `job_link` | |
| `Notes` | `notes` | Newlines preserved inside the quoted field |
| `Archived` | `is_archived` | `Yes` / `No` |
| `Added` | `created_at` | `YYYY-MM-DD` |
| `Last Status Change` | `status_changed_at` | `YYYY-MM-DD` |

`id` and `user_id` are **not exported.** They are meaningless outside this database, and including
them invites a user to try to "restore" by re-importing, which would fail on the `user_id` foreign
key in confusing ways.

## Implementation

```ts
// src/lib/csv.ts
import type { Application } from '../services/applicationsService';
import { STATUS_LABELS } from '../constants/status';
import { PLATFORM_LABELS } from '../constants/platforms';

export function applicationsToCsvRows(applications: Application[]) {
  return applications.map((a) => ({
    Company: a.company_name,
    'Job Title': a.job_title,
    Status: STATUS_LABELS[a.status],
    Platform: PLATFORM_LABELS[a.platform_source],
    Location: a.location ?? '',
    'Salary Range': a.salary_range ?? '',
    'Applied Date': a.applied_date ?? '',
    'Job Link': a.job_link ?? '',
    Notes: a.notes ?? '',
    Archived: a.is_archived ? 'Yes' : 'No',
    Added: a.created_at.slice(0, 10),
    'Last Status Change': a.status_changed_at.slice(0, 10),
  }));
}

export async function downloadCsv(applications: Application[], filename: string) {
  const { unparse } = await import('papaparse');          // lazy — see Dependencies
  const csv = unparse(applicationsToCsvRows(applications));

  // The BOM makes Excel open UTF-8 correctly. Without it, "Peso ₱25,000" and any
  // non-ASCII company name render as mojibake — the most common complaint about
  // CSV exports opened on Windows.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
```

Filename: `job-applications-YYYY-MM-DD.csv`.

**No server involvement.** The rows are already in the TanStack Query cache; export is a pure
client-side transform of data the user is looking at. There is no reason to re-fetch, and no reason
for an Edge Function.

---

# Part 2 — Import

The harder half. An import that silently creates thirty wrong rows is far worse than one that
refuses to run.

## Flow overview

```
1. Choose file        →  2. Map columns       →  3. Review & fix      →  4. Import
   (drop or browse)      (auto-guessed,          (per-row validation,    (chunked insert,
                          user-correctable)       errors inline)          progress, result)
```

Presented as a four-step modal. The user can go back at any step; nothing is written until step 4.

## Step 1 — Choose file

- Drag-and-drop zone plus a file input. Accepts `.csv` only.
- **Max 500 rows, max 1MB.** Beyond that, refuse with a clear message rather than attempting it —
  this matches the `.limit(500)` list ceiling in [02](./02-backend-architecture.md), so importing
  more rows than the app can display would be actively misleading.
- Parse with `Papa.parse(file, { header: true, skipEmptyLines: 'greedy' })`.
- Immediate failures (not a CSV, no header row, zero data rows) surface here and go no further.

## Step 2 — Column mapping

The app must not assume anyone's column names. It guesses, then lets the user correct.

```ts
// Normalized header → our field. Deliberately generous: these are the names
// real spreadsheets actually use.
const HEADER_ALIASES: Record<string, keyof ImportRow> = {
  company: 'company_name', companyname: 'company_name', employer: 'company_name',
  organization: 'company_name', organisation: 'company_name',

  jobtitle: 'job_title', title: 'job_title', position: 'job_title', role: 'job_title',

  status: 'status', stage: 'status',
  platform: 'platform_source', source: 'platform_source', jobboard: 'platform_source',
  via: 'platform_source', website: 'platform_source',

  location: 'location', city: 'location', place: 'location',
  salary: 'salary_range', salaryrange: 'salary_range', pay: 'salary_range',
  compensation: 'salary_range',

  applieddate: 'applied_date', dateapplied: 'applied_date', date: 'applied_date',
  applied: 'applied_date',

  joblink: 'job_link', link: 'job_link', url: 'job_link', joburl: 'job_link',
  posting: 'job_link',

  notes: 'notes', comments: 'notes', remarks: 'notes',
};

const normalize = (h: string) =>
  h.replace(/^﻿/, '').toLowerCase().replace(/[\s_-]/g, '');
```

UI: one row per detected CSV column, each with a Select of our fields (plus **"Don't import"**).
Guessed mappings are pre-selected. **Company** and **Job Title** are required to be mapped; the
Continue button stays disabled with an inline explanation until both are.

Note the leading `.replace(/^﻿/, '')` — Excel writes a BOM, and without stripping it the first
column never matches an alias, which presents as "why is Company the only one it didn't detect?"

## Step 3 — Review and fix

Every row is validated before anything is written. Results render as a table of the parsed rows with
per-row state.

### Value coercion

| Field | Rule |
|---|---|
| `company_name`, `job_title` | Trimmed. Empty → row error. |
| `status` | Matched case-insensitively against `STATUS_LABELS` values *and* enum values, ignoring spaces/underscores. Unrecognized or empty → **defaults to `pending_application`** with a row warning, not an error. |
| `platform_source` | Same matching against `PLATFORM_LABELS`. Unrecognized or empty → **`other`** with a warning. |
| `applied_date` | Accepts `YYYY-MM-DD`, `MM/DD/YYYY`, `DD/MM/YYYY`. **Ambiguous dates (both parts ≤ 12) are resolved using a single format choice the user makes once for the whole file** — a Select above the table, defaulted from the locale. Unparseable → warning, field left null. |
| `job_link` | Bare domains get `https://` prepended (same convenience as the form, F2). Still-invalid → warning, field left null. |
| `salary_range`, `location`, `notes` | Trimmed, `''` → null. |
| `is_archived` | Not importable. Everything imports as active. |

**Errors block that row. Warnings do not.** The only errors are a missing company or job title —
everything else degrades to a sensible default, because refusing an entire import over an
unrecognized platform string would be user-hostile.

### Duplicate handling

Before showing the review table, the parsed rows are checked against existing applications
(reusing `findPotentialDuplicates`, batched) **and against each other**.

Each duplicate row is flagged with a checkbox, checked by default, labeled **"Skip — already
tracked."** The user can uncheck any of them to import anyway.

### Review table

```
┌──────────────────────────────────────────────────────────────────────────┐
│ 24 rows ready · 2 warnings · 1 error · 3 duplicates skipped              │
├───┬──────────────────┬─────────────────────┬──────────┬──────────────────┤
│ ✓ │ Acme Corporation │ Backend Developer   │ Pending  │                  │
│ ⚠ │ Globex           │ Cloud Engineer      │ Pending  │ Unknown status   │
│ ✕ │ (missing)        │ Data Analyst        │ —        │ Company required │
│ ⊘ │ Initech          │ Software Engineer I │ Rejected │ Already tracked  │
└───┴──────────────────┴─────────────────────┴──────────┴──────────────────┘
```

The summary line is the important part — a user should know exactly what is about to happen before
committing. The Import button reads **"Import 24 applications"**, naming the real count after
exclusions.

## Step 4 — Import

1. `importMany.mutate(validRows)` → `bulkCreate` ([02](./02-backend-architecture.md)), inserting in
   sequential chunks of 100.
2. A determinate progress bar — for 300 rows this takes long enough that an indeterminate spinner
   feels broken.
3. **On success:** modal closes, toast "Imported 24 applications.", list invalidated.
4. **On partial failure:** `PartialImportError` carries how many committed. The modal stays open
   with an honest message:

   > **Imported 100 of 240 applications.**
   > Something went wrong partway through. The first 100 were saved. You can retry the rest — the
   > duplicate check will skip anything already imported.
   > [Retry remaining] · [Close]

   This is why chunks are sequential rather than parallel: "the first 100 committed" is a statement
   that can be made truthfully. With parallel chunks, a failure leaves an unknown subset written and
   there is nothing honest to tell the user.

## What import deliberately does not do

- **No status history reconstruction.** Every imported row gets exactly one history entry (its
  creation), written by the existing trigger. Fabricating a timeline from a spreadsheet would put
  invented data into an audit trail whose entire value is that it is trustworthy.
- **No `is_archived` import**, per the coercion table.
- **No update-existing / upsert mode.** Import creates; it never modifies existing rows. An import
  that silently overwrites edits made in the app is a data-loss bug wearing a feature's clothes.
- **No scheduled or automatic re-import.** One-shot, user-initiated, always.

---

## Testing

| Case | Expectation |
|---|---|
| Excel-exported CSV with BOM | First column maps correctly |
| Quoted field containing commas | Parsed as one field |
| Notes field containing newlines | Preserved, row not split |
| `DD/MM/YYYY` vs `MM/DD/YYYY` ambiguity | Uses the file-level format choice |
| Unknown status string | Warning, defaults to Pending, row still imports |
| Missing company | Row errors, is excluded, rest still import |
| All rows duplicates | Import button disabled with "Nothing to import" |
| 501 rows | Rejected at step 1 with the row-limit message |
| Failure at chunk 2 of 3 | `PartialImportError`, honest count, retry offered |
| Round trip: export → import | Same logical data, statuses and platforms preserved |

That last one is the highest-value test in the set — it exercises the label-to-enum mapping in both
directions and catches the class of bug where export writes `Scheduled for Interview` and import
does not recognize it.
