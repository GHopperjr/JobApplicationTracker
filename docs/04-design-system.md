# 04 — Design System

## Direction: minimalism, defined concretely

"Minimalist" is easy to say and easy to get wrong — it does not mean sparse, grey, and
undesigned. For this project it means a specific set of commitments:

1. **Color carries meaning, never decoration.** Saturated color in the interface is reserved to
   three narrow, semantic uses — status, platform, and (in exactly one place) user identity. No
   gradients, no accent buttons competing for attention, no color introduced purely for visual
   variety. When a user's eye is drawn to color, it is because that color is telling them
   something — the state of an application, which platform it came from, or whose account this
   is.
   - **Status** is reinforced more strongly than a badge alone: the Kanban column header carries a
     ringed dot and a matching 2px bottom border in the same hue, so columns are identifiable at a
     glance without reading the label first. Pending stays neutral even here (see the status table).
   - **Platform** gets its own small, fixed palette (below), used only for the dot in a Kanban
     card's meta row — a second, independent signal from status color, chosen so the two are never
     confusable at a glance.
   - **User identity** (the account-menu avatar) uses a single reserved hue (indigo) that appears
     nowhere else in the interface, specifically so it can never be mistaken for status or platform
     meaning.
2. **Hierarchy comes from type and space, not from boxes.** Prefer whitespace and weight
   contrast over borders, shadows, and cards-within-cards. Where a boundary is genuinely needed
   (a Kanban card, a drawer), it is one hairline rule or one very soft shadow — never both.
3. **Every element earns its place.** No decorative icons, no illustrations, no "empty state
   mascot." Icons appear only where they replace a word that would otherwise repeat many times
   (a drag handle, a close button).
4. **Density is a feature.** This is a tool someone opens 20 times a week to scan status. It
   should feel closer to a well-set spreadsheet than to a marketing page — comfortable, but not
   airy for its own sake.

## Color

### Neutrals

The interface is built almost entirely from a cool-tinted neutral ramp — Tailwind's `slate`,
chosen over pure `gray` because its slight blue cast keeps the surface from looking dingy next to
the status colors.

| Token | Tailwind | Use |
|---|---|---|
| Page background | `bg-slate-50` | The app canvas |
| Surface | `bg-white` | Cards, table, modals, drawers |
| Border | `border-slate-200` | Hairlines, dividers, input borders |
| Border (strong) | `border-slate-300` | Input focus-adjacent, drag-over states |
| Text primary | `text-slate-900` | Company names, headings, values |
| Text secondary | `text-slate-600` | Job titles, labels, metadata |
| Text tertiary | `text-slate-500` | Timestamps, placeholders, empty hints |

### Status colors

The one place saturation is allowed. Each status gets a hue that maps to intuitive meaning, with a
light background for badges and a solid dot for compact contexts.

| Status | Hue | Badge | Dot | Rationale |
|---|---|---|---|---|
| Pending Application | slate | `bg-slate-100 text-slate-700` | `bg-slate-400` | Neutral — nothing has happened yet. Deliberately *not* colorful, so a board full of pending applications reads as calm rather than alarming. |
| Scheduled for Interview | blue | `bg-blue-50 text-blue-700` | `bg-blue-500` | Forward motion, something is booked. |
| Interviewed | violet | `bg-violet-50 text-violet-700` | `bg-violet-500` | Distinct from "scheduled" at a glance while staying in the same cool family — these two are adjacent stages and must not be confusable. |
| Rejected | rose | `bg-rose-50 text-rose-700` | `bg-rose-500` | Negative outcome. Rose rather than red — softer, since a job seeker will see this color a lot and it should not feel like an error alarm. |
| Accepted | emerald | `bg-emerald-50 text-emerald-700` | `bg-emerald-600` | The win. The only green in the app, so it never appears except as good news. |

**Accessibility:** every badge pairing above clears WCAG AA (4.5:1) for normal text. Status must
never be communicated by color alone — every badge carries its text label, and the Kanban column
header states the status name.

### Platform colors

A second, independent palette — deliberately disjoint from the status hues above, so a platform
dot is never mistaken for a status signal. Text label always accompanies the dot; color is a scan
aid, not the only signal.

| Platform | Dot |
|---|---|
| JobStreet | `bg-purple-500` |
| LinkedIn | `bg-sky-500` |
| Indeed | `bg-teal-500` |
| Company Website | `bg-slate-500` |
| Referral | `bg-amber-500` |
| Other | `bg-slate-400` |

Used only on the Kanban card's meta-row dot (`constants/platforms.ts`'s `PLATFORM_STYLES`). The
table view keeps platform as plain text — a dot repeated in every row of a dense table adds noise
without adding scannability the way it does on a spaced-out board.

### Semantic (non-status) color

Used only in transient feedback, never in persistent chrome:

- Destructive action confirm: `bg-rose-600 text-white`
- Toast success: `text-emerald-700` with `bg-emerald-50`
- Toast error: `text-rose-700` with `bg-rose-50`
- Focus ring: `ring-2 ring-slate-900 ring-offset-2` — a neutral ring, so focus never reads as a
  status color.

## Typography

One typeface. A minimalist interface with two competing type families is not minimalist.

**Inter** (via Google Fonts), with a system fallback stack:

```css
font-family: Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
```

Numerals use `font-variant-numeric: tabular-nums` in the table and on all dates, so columns of
dates and salaries align vertically.

### Type scale

| Role | Size / weight | Tailwind | Notes |
|---|---|---|---|
| Page title | 20px / 600 | `text-xl font-semibold` | "Applications" — the only page-level heading |
| Section heading | 14px / 600 | `text-sm font-semibold` | Kanban column headers, drawer section labels |
| Card title | 14px / 600 | `text-sm font-semibold` | Company name on a card |
| Body | 14px / 400 | `text-sm` | Job titles, table cells, notes |
| Label | 12px / 500 | `text-xs font-medium` | Form labels, badges, metadata keys |
| Meta | 12px / 400 | `text-xs text-slate-500` | Dates, counts, placeholder text |

Nothing is larger than 20px anywhere in the app. There is no hero, no display type — this is a
tool, and oversized headings would waste the vertical space that board columns need.

## Spacing and radius

Use a 4px base scale (Tailwind's default). In practice the app uses a deliberately small subset —
constraining the vocabulary is what makes spacing look intentional rather than arbitrary:

**Layout spacing** (padding, gaps, stacks): `2` (8px) · `3` (12px) · `4` (16px) · `6` (24px) ·
`8` (32px)

**Control vertical padding** is the one place half-steps are permitted — `0.5`, `2`, `2.5` — because
input height, badge height, and table row height are tuned against the 14px/12px type sizes rather
than against the layout grid. A `py-3` table cell is noticeably too tall for a dense list; a `py-2`
badge is too tall for inline text. These are the only exceptions, and they appear only in the
component specs below.

| Context | Value |
|---|---|
| Card padding | `p-3` |
| Column gap (Kanban) | `gap-4` |
| Page padding (desktop) | `px-6 py-4` |
| Page padding (mobile) | `px-4 py-3` |
| Form field vertical rhythm | `space-y-4` |
| Table cell padding | `px-3 py-2.5` |

**Radius:** `rounded-lg` (8px) on cards, modals, and drawers; `rounded-md` (6px) on inputs and
buttons; `rounded-full` only on status dots and badges. One step of variation, no more.

**Shadows:** exactly two exist in the system.
- `shadow-sm` — resting cards.
- `shadow-lg` — modals, drawers, and the card currently being dragged.

Everything else uses borders. A minimalist interface with five shadow depths is a maximalist
interface wearing grey.

## Components

### `ApplicationCard` (Kanban)

```
┌─────────────────────────────────────┐
│ Acme Corporation           ● ⋮      │   ← company (14/600), stale dot, overflow menu
│ Junior Backend Developer            │   ← job title (14/400, slate-600)
│ ─────────────────────────────────── │   ← hairline divider, border-slate-100
│ ● JobStreet          ₱25–32k · Sep 1│   ← platform (left, 12/500 slate-700) · salary/date (right, 12/400 slate-400)
└─────────────────────────────────────┘
```

The meta row is a divider (`border-t border-slate-100`, `pt-2.5`) plus a `justify-between` split:
platform (dot + label, the more prominent side) on the left, salary and date (joined by `·`) on the
right. Splitting the two groups — rather than one run-on line — is what keeps the row scannable as
"how" on one side and "when/how much" on the other, instead of four unrelated facts read
left-to-right in one breath.

The amber dot beside `⋮` appears only when the application is stale (see below); the dot in the
meta row is the platform marker (see Platform colors above) and is always present.

- Surface `bg-white`, `border border-slate-200`, `rounded-lg`, `shadow-sm`, `p-3`.
- Whole card is the drag handle on desktop; the `⋮` menu opens status change + edit + delete.
- Hover: `border-slate-300` and `shadow-md`. No lift, no scale — motion on hover in a dense board
  is noise, but a deeper shadow on the surface itself is not motion.
- Dragging: `shadow-lg`, `opacity-90`, slight `rotate-1`. The original position shows a
  `border-2 border-dashed border-slate-200` placeholder so the drop target is unambiguous.
- Click (not drag) opens the Detail Drawer.
- Salary and date are truncated/omitted before the company or title ever wrap — the two
  identifying fields always survive.

### `KanbanColumn`

```
● Pending Application  7             ← ringed status dot + label (14/600) + count (12/500, slate-500)
━━━━━━━━━━━━━━━━━━━━━━━━━            ← 2px status-hue border (STATUS_STYLES.headerBorder)
[ card ]
[ card ]
[ card ]
```

- Column width: `w-80` (320px) fixed on desktop. Fixed rather than fluid so the board's rhythm
  stays stable as columns fill and empty.
- Header dot: the status's `dot` color with a soft `ring-4` in that status's own 100-shade
  (`STATUS_STYLES.ring`), and the header's bottom border switches from a flat hairline to a 2px
  rule in the status hue (`STATUS_STYLES.headerBorder`). Pending stays neutral (`ring-slate-100` /
  `border-slate-300`) for the same reason its dot and badge stay neutral — see Status colors above.
- Column background: transparent on the `bg-slate-50` canvas — cards float directly on the page.
  A separate column background would add a second surface level for no informational gain.
- Drag-over state: `bg-slate-100` on the column body. Nothing else — no border flash, no scale.
- Empty column: a single line of `text-xs text-slate-500`, e.g. "Nothing here yet." No
  illustration, no oversized dropzone graphic.
- The count in the header is the only number on the board and is genuinely useful ("do I have
  eleven things pending?"), so it earns its place.

### Stale indicator

An application that has sat in the same non-terminal status past the threshold
([03](./03-frontend-architecture.md)) gets **one** marker, and deliberately not more:

- **On the card:** a 6px amber dot (`bg-amber-500`) at the card's top-right, before the `⋮`. Its
  `title`/`aria-label` reads "No change in 18 days."
- **In the table:** the same dot, inline before the Applied date.
- **Nowhere else.** No amber border, no background tint, no row highlight.

**Why so restrained:** in a slow job search, *most* applications will eventually be stale. A
treatment loud enough to notice on one card becomes a wall of amber across twenty, at which point it
communicates nothing and just makes the board stressful to look at. A small dot stays scannable at
any density.

Amber is the one hue outside the status palette. It is permissible here precisely because it is not
a status — it is a property *of* a status's age — and confusing the two would be worse than
introducing a sixth color. It never appears on a Rejected or Accepted card, so it cannot be mistaken
for an outcome.

### Archived treatment

Archived applications are hidden from the default view entirely, so this treatment applies only
inside the archive view itself:

- Card and row content render at `opacity-60`.
- Company name drops from `text-slate-900` to `text-slate-600`.
- The `⋮` menu's first item becomes "Restore" instead of "Archive".
- Archived cards are **not draggable** — the board is a pipeline of live applications, and dragging
  something that isn't in the pipeline is meaningless. Status changes on archived rows go through
  the menu.

### `StatusBadge`

`rounded-full px-2 py-0.5 text-xs font-medium`, using the badge pair from the status table above.
Used in the Table view and the Detail Drawer. Not used on Kanban cards — the card's column already
communicates status, and a badge there would be redundant ink.

### `ApplicationsTable`

- Header row: `text-xs font-medium text-slate-600 uppercase tracking-wide`, `border-b
  border-slate-200`, sticky on scroll.
- Body rows: `border-b border-slate-100` — a lighter rule than the header, so the header reads as
  a boundary and the body reads as a rhythm.
- Row hover: `bg-slate-50`. Row click opens the Detail Drawer.
- Zebra striping is **not** used — with hairline row rules it's redundant and adds visual noise.
- Sortable column headers show a small chevron only on the active sort column; inactive columns
  show nothing until hover. Persistent up/down arrows on every column is clutter.

Column set (desktop): Company · Job Title · Status · Platform · Location · Applied · Salary · ⋮

Column set (tablet): Company · Job Title · Status · Applied · ⋮

### `Modal` and `Drawer`

Both use `shadow-lg`, `rounded-lg` (drawer: rounded on the leading edge only), and a
`bg-slate-900/20` backdrop — a soft scrim, not a heavy blackout.

- **Modal** (`ApplicationFormModal`): centered, `max-w-lg`, for creating and editing. Desktop and
  tablet.
- **Drawer** (`ApplicationDetailDrawer`): slides from the right, `w-full max-w-md`, for reading a
  full record. Chosen over a modal for detail because it preserves the board/table context
  behind it — the user can see where the application sits while reading it.
- **On mobile, both become bottom sheets** that slide up to ~90vh with a drag handle. A centered
  modal on a small screen fights the keyboard; a bottom sheet does not.

Both trap focus, close on `Esc`, close on backdrop click, and return focus to the triggering
element on close.

**Exception — the form modal with unsaved changes.** When `ApplicationFormModal` is dirty, `Esc` and
backdrop click do not close it directly; they open the "Discard changes?" confirmation
([05](./05-features-and-workflows.md), F3). A clean (untouched) form closes immediately with no
prompt — prompting on a form the user never typed in is the kind of friction that trains people to
click through dialogs without reading them.

The Detail Drawer is read-only and always closes immediately.

### Buttons

| Variant | Style | Use |
|---|---|---|
| Primary | `bg-slate-900 text-white hover:bg-slate-800` | The single main action on a screen ("Add Application", "Save") |
| Secondary | `bg-white border border-slate-200 text-slate-700 hover:bg-slate-50` | Cancel, secondary actions |
| Ghost | `text-slate-600 hover:bg-slate-100` | Toolbar and menu actions |
| Destructive | `bg-rose-600 text-white hover:bg-rose-700` | Delete confirmation only |

**The primary button is near-black, not blue.** In a system where color means status, a blue
primary button would read as "scheduled for interview." Neutral-dark primaries keep the status
palette unambiguous — this is the single most important color decision in the system.

### Form fields

- Input: `border border-slate-200 rounded-md px-3 py-2 text-sm`, focus
  `ring-2 ring-slate-900 ring-offset-1 border-transparent`.
- Label: `text-xs font-medium text-slate-600 mb-1`, always visible above the field — never a
  placeholder-as-label, which disappears exactly when the user needs it.
- Error: `text-xs text-rose-600 mt-1`, with `border-rose-300` on the field. The message states
  what to do ("Enter a valid URL starting with http:// or https://"), not what went wrong
  ("Invalid input").
- Required fields marked with a `*` in the label; optional fields are simply unmarked. Do not
  label optional fields "(optional)" — with only four required fields, the marked minority is the
  shorter list.

## Responsive behavior

### Kanban on mobile (`< 768px`)

Columns become a tab bar:

```
┌──────────────────────────────────────────┐
│ Pending 7 │ Scheduled 2 │ Interviewed 1 │…│   ← horizontally scrollable tabs
├──────────────────────────────────────────┤
│ [ card ]                                  │
│ [ card ]                                  │   ← single column, full width
└──────────────────────────────────────────┘
```

- The active tab's count is bold; inactive counts are `text-slate-500`.
- **Status changes happen via the card's `⋮` menu → "Move to…".** This is the only status-change
  path on mobile.
- **Drag-and-drop is disabled below 768px** — `DndContext` receives no `TouchSensor`, so a touch
  drag on a card does nothing.

**Why drag is disabled rather than merely "not the designed path":** a horizontal touch-drag
starting on a card is ambiguous — it could be a dnd-kit drag or a swipe to the adjacent status tab,
and no threshold reliably separates the two. Supporting both produces an interface where the same
gesture does different things depending on timing. One of them had to go, and drag is the one that
was already awkward on a 375px screen where the destination column isn't even visible.

- **Horizontal swipe on the card area moves between status tabs**, matching the tab order. With
  touch dragging disabled, this gesture is unambiguous.

### Table on mobile (`< 768px`)

The table degrades to a stacked card list — never a horizontally scrolling table, which is
unusable on a phone:

```
┌──────────────────────────────────────────┐
│ Acme Corporation          [Pending]      │
│ Junior Backend Developer                 │
│ JobStreet · Makati City · Sep 1          │
└──────────────────────────────────────────┘
```

Sort and filter move into a bottom-sheet control opened from the toolbar.

### Touch targets

Every interactive element is at least 44×44px on touch devices. The `⋮` menu button and tab
targets are the two that need explicit padding to reach this — a 16px icon in a 24px box fails.

## Motion

Minimal and functional only:

| Interaction | Motion |
|---|---|
| Drawer / bottom sheet | 200ms ease-out slide |
| Modal | 150ms fade + 1% scale |
| Card drag | No transition on the dragged element (it must track the pointer exactly); 150ms ease on siblings reflowing |
| Toast | 150ms fade-in, auto-dismiss 4s |
| Hover states | 100ms color transition |

Everything respects `prefers-reduced-motion: reduce` by dropping to opacity-only or instant.

**No skeleton shimmer animation.** Loading states use static `bg-slate-100` blocks. A pulsing
shimmer on a board of twelve cards is significantly more distracting than a still placeholder.

## Empty and loading states

| State | Treatment |
|---|---|
| First-run (no applications at all) | Centered, `text-sm text-slate-600`: "No applications yet." + primary "Add your first application" button. One line of copy, one action. |
| Filtered to nothing | "No applications match these filters." + ghost "Clear filters" button. |
| Empty Kanban column | One line, `text-xs text-slate-500`: "Nothing here yet." |
| Loading (initial) | Three skeleton cards per column / five skeleton rows. Static, no shimmer. |
| Loading (refetch) | Nothing. Existing data stays on screen; no spinner, no dimming — a background refetch that visibly disrupts the view is worse than a slightly stale one. |
| Error | Inline `text-sm text-rose-700` with a "Try again" ghost button. Never a full-page error screen for a failed list fetch. |

---

Next: [05 — Features & Workflows](./05-features-and-workflows.md).
