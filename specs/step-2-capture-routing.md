# Step 2 Spec — Capture + Routing

**Status:** Resolved — awaiting Malachi's final approval before any code is written.
**Depends on:** Step 1 complete ✅
**Out of scope:** Morning brief, evening recap, scheduled execution, any UI.

---

## Objective

Build a single script — `scripts/capture.ts` — that takes a plain-English input string, figures out where it belongs, and writes it to the right place. This is how new information enters the system.

Examples of inputs it should handle:

| Input | Should route to |
|---|---|
| "Hayden has a job interview Tuesday" | Prayer roster — new `date_anchored` entry for Hayden |
| "Pray for Hayden's job search" | Prayer roster — new `ongoing` entry for Hayden |
| "Pray for Mom's surgery on Thursday" | Prayer roster — new `date_anchored` entry (Mom already in roster) |
| "Pray for Coach Davis on Friday" | Prayer roster — Coach Davis not in roster, asks first |
| "Add gym tomorrow at 9am" | Google Calendar (Tier 2 default) |
| "Sunday service every week Tier 1" | `routine.json` anchors |
| "I want to memorize Philippians 4:13 this week" | `routine.json` practice goals |
| "Buy groceries" | Google Tasks |
| "What if I started a podcast about faith and fitness" | Idea Brain (Google Doc) |

---

## How the script runs

You run it like this from the terminal:

```bash
npx tsx scripts/capture.ts "Hayden has a job interview Tuesday"
```

It goes through four stages every time:

### Stage 1 — Classify
The script reads the input and proposes a destination and type. Example output:

```
Input: "Hayden has a job interview Tuesday"

I think this is:
  Destination : Prayer roster (new date-anchored entry)
  Person      : Hayden (existing in roster — will reuse exact name)
  Situation   : job interview
  Date        : Tuesday → 2026-04-28

Is this right? [y] yes  [n] no, let me choose  [q] quit
```

If the user picks `n`, the script shows a numbered list of all destinations and lets them pick manually.

### Stage 2 — Format
Once the destination is confirmed, the script shows exactly what it will write. No surprises. Example:

```
Here's the new entry that will be appended to prayer-roster.json:

{
  "name": "Hayden",
  "relation": "friend",
  "situation": "job interview",
  "type": "date_anchored",
  "date": "2026-04-28",
  "last_surfaced": null
}

Confirm write? [y] yes  [n] cancel
```

Hayden's existing baseline entry (`type: "ongoing"`, `situation: "Pray for safe travel"`) stays untouched. Both entries now exist in the roster, both share `name: "Hayden"`, so any future query for "all of Hayden's prayer requests" filters by name and returns both.

### Stage 3 — DRY_RUN gate
- If `DRY_RUN=true` (the default): the script logs what would have been written and exits without touching anything. It prints a clear notice: `DRY_RUN is on — nothing was written.`
- If `DRY_RUN=false`: the write executes.

### Stage 4 — Confirm
On a real write, the script prints a confirmation:
```
Written to prayer-roster.json
```
On a dry run:
```
[DRY RUN] Would have written to prayer-roster.json
```

---

## Destinations and how each one is written

| Destination | Where it writes | How |
|---|---|---|
| Prayer roster | `config/prayer-roster.json` | Direct file write — appends a new entry to the `people` array |
| Routine — anchors | `config/routine.json` | Direct file write — appends to `anchors` array |
| Routine — practice goals | `config/routine.json` | Direct file write — appends to `practice_goals` array |
| Google Calendar | (stub for Step 2) | Logs structured payload; real call wired in Step 4 |
| Google Tasks | (stub for Step 2) | Logs structured payload; real call wired in Step 4 |
| Idea Brain | (stub for Step 2) | Logs the line that would be appended; real call wired in Step 4 |

Local writes (prayer roster, routine.json) execute for real in Step 2 (when `DRY_RUN=false`). Remote writes are stubs — explained next.

---

## Remote connectors: stubbed for Step 2

`capture.ts` runs as a standalone Node script (`npx tsx ...`), which means it has no access to MCP connectors — those only work inside Claude Code. So for Step 2:

The three connector files (`calendar.ts`, `tasks.ts`, `drive.ts`) are written as stubs. Each one accepts a structured payload and logs exactly what it would send. Example for Calendar:

```typescript
// connectors/calendar.ts
export type CalendarEventInput = {
  title: string;
  date: string;       // ISO date "2026-04-28"
  time: string;       // "09:00" (24-hour)
  durationMinutes: number;
  timezone: string;   // "America/Los_Angeles"
  tier: 1 | 2 | 3;
};

export async function createCalendarEvent(input: CalendarEventInput): Promise<void> {
  console.log("[STUB] Calendar.createEvent would be called with:");
  console.log(JSON.stringify(input, null, 2));
}
```

The interface (the exact shape of `CalendarEventInput`) is locked now. When Step 4 swaps in the real MCP call, nothing in `capture.ts` has to change.

The three connector interfaces:

**Calendar** — `{ title, date, time, durationMinutes, timezone, tier }`
**Tasks** — `{ title, notes?, dueDate? }`
**Drive (Idea Brain)** — `{ docId, line }` where `line` is the formatted entry to append

The Idea Brain doc ID — `1jaeSjOWcY4d46qOF3MqKMKr89SZmScZ-5QIf_MwC9Ng` — is stored in `config/flags.json` as `IDEA_BRAIN_DOC_ID` so it's not hardcoded in the connector.

---

## Locked decisions (resolved from open questions)

**Q1 — Connectors** → All three remote writes are stubs with locked interfaces. Real wiring is Step 4.

**Q2 — Idea Brain doc** → `1jaeSjOWcY4d46qOF3MqKMKr89SZmScZ-5QIf_MwC9Ng`. Stored in `config/flags.json`.

**Q3 — Calendar tier** → Default to Tier 2. If input contains "Tier 1" or "Tier 3" (case-insensitive), use that instead. The script shows the inferred tier in Stage 1 so you can correct via `n`.

**Q4 — Unknown person in prayer** → Ask before adding. Flow:
```
"Pray for Coach Davis on Friday"

Coach Davis is not in your prayer roster.
Add them? [y] yes  [n] cancel

Relation? (e.g., friend, family, mentor, brother): mentor
Situation? (what's the prayer request): upcoming surgery

[shows formatted entry, then standard confirm/DRY_RUN flow]
```

For new people, the entry's `type` is determined automatically from the input: date in input → `date_anchored`, no date → `ongoing`. No baseline "safe travel" entry is auto-added — that was specific to the seeded 9.

---

## Idea Brain entry format

When something routes to Idea Brain, the appended line is:

```
- 2026-04-27 — what if I started a podcast about faith and fitness
```

Format: `- {YYYY-MM-DD} — {raw input verbatim}`. Date prefix makes the doc scannable in chronological order. The raw input is preserved exactly so no nuance is lost.

---

## Prayer roster: how entries are added

Every prayer capture results in either a new entry in `people[]`, or no write. Existing entries are never modified.

**Type rule:**
- Input contains a date phrase → new entry has `type: "date_anchored"` and a `date` field
- Input has no date → new entry has `type: "ongoing"`

**Person lookup:** the script searches `people[]` for any existing entry whose `name` matches the input's name (case-insensitive). If found, the new entry reuses the existing exact-case name string so all of that person's entries can be retrieved with a single name match.

**Cases:**

1. **Person in roster, situation + optional date** (e.g., "Hayden has a job interview Tuesday", "Pray for Hayden's job search") → appends a new entry. Existing baseline ("Pray for safe travel") stays. Hayden ends up with multiple entries, all linked by `name: "Hayden"`.

2. **Person in roster, no situation, no date** (e.g., "pray for Hayden") → no write. Script prints: `Hayden is already in your roster. Add a specific situation? [y/n]` — `y` reprompts for situation text, `n` exits.

3. **Person not in roster** (e.g., "Pray for Coach Davis on Friday") → Q4 flow: confirm add, ask relation, ask situation if not extractable, then format and write a single new entry.

**Schema impact on `prayer-roster.json`:** zero. Same fields as the seeded entries (`name`, `relation`, `situation`, `type`, `last_surfaced`, plus `date` for date_anchored entries). Schema is already capable of representing this — the seed file just only has ongoing entries today.

---

## Classification heuristics

The script uses these rules in order — first match wins:

1. **Prayer roster** — input contains "pray", "prayer", "praying" anywhere; OR input mentions a name already in the roster combined with a situation/date phrase
2. **Routine / anchor** — input contains "every week", "every day", "every morning", "every night", recurring time block; or explicit "anchor"
3. **Routine / practice goal** — input contains "memorize", "practice", "learn", "verse of the week", "reading goal"
4. **Calendar** — input contains a specific day or time ("tomorrow", a weekday name, "at 9am", "next Friday"), single occurrence
5. **Tasks** — input is an action verb without a specific time ("buy", "email", "order", "call", "schedule")
6. **Idea Brain** — anything else: open-ended thought, question, "what if", possibility

If no rule matches with confidence, Stage 1 is skipped and the script asks the user to pick manually.

**Conflict example:** "Pray for Mom's surgery on Thursday" matches both prayer (rule 1, contains "pray") and calendar (rule 4, contains "Thursday"). Rule 1 wins because it's first. Correct outcome.

---

## Date parsing

Dates inside inputs ("tomorrow", "Tuesday", "next Friday") are parsed using **`chrono-node`** — a well-maintained library specifically for natural language date parsing in JavaScript/Node. Adding it requires `npm install chrono-node`.

Why a library: writing this from scratch is a known trap. "Next Tuesday" is ambiguous (this week's Tuesday or next week's?), edge cases around midnight crossings, day-of-week resolution — chrono handles it.

The parsed date is always shown to the user in Stage 1 so they can catch a misinterpretation:

```
Date: Tuesday → 2026-04-28  ← do they look right to you?
```

---

## Files created or changed in Step 2

```
life-os/
├── scripts/
│   └── capture.ts            ← new: the capture script
├── connectors/
│   ├── calendar.ts           ← new: stub with locked CalendarEventInput interface
│   ├── tasks.ts              ← new: stub with locked TaskInput interface
│   └── drive.ts              ← new: stub with locked DriveAppendInput interface
├── config/
│   └── flags.json            ← add IDEA_BRAIN_DOC_ID field
├── specs/
│   └── step-2-capture-routing.md   ← this file
└── package.json              ← add chrono-node dependency
```

---

## Out of scope for Step 2

- Reading data back out of any system (that's Steps 3–5)
- Morning brief or evening recap composition
- Scheduling or automation
- Any UI beyond the terminal
- Handling inputs that update or delete existing calendar events or tasks (capture only creates new items)
- Routing to Google Tasks sub-lists or specific calendars (default calendar and default task list only, for now)
- Real MCP calls (stubs for Step 2; real wiring is Step 4)

---

## Manual test checklist

Run these after Step 2 is built to confirm it works:

### Setup
- [ ] `npm install` succeeds with chrono-node added
- [ ] `npm run typecheck` passes with the new files
- [ ] `flags.json` has `DRY_RUN: true` and `IDEA_BRAIN_DOC_ID: "1jaeSjOWcY4d46qOF3MqKMKr89SZmScZ-5QIf_MwC9Ng"`

### Local destinations (DRY_RUN on)
- [ ] `npx tsx scripts/capture.ts "Pray for Mom's surgery Thursday"` → recognizes Mom in roster, appends new `date_anchored` entry, prints DRY RUN notice
- [ ] `npx tsx scripts/capture.ts "Hayden has a job interview Tuesday"` → recognizes Hayden in roster, appends new `date_anchored` entry alongside his existing ongoing entry
- [ ] `npx tsx scripts/capture.ts "Pray for Hayden's job search"` → recognizes Hayden, appends new `ongoing` entry (no date)
- [ ] `npx tsx scripts/capture.ts "Pray for Coach Davis on Friday"` → Coach Davis not in roster, asks to add, prompts for relation, then formats date_anchored entry
- [ ] `npx tsx scripts/capture.ts "pray for Hayden"` → no situation given, prompts "add specific situation?"
- [ ] `npx tsx scripts/capture.ts "Memorize Philippians 4:13 this week"` → routes to practice_goals
- [ ] `npx tsx scripts/capture.ts "Sunday service every week Tier 1"` → routes to anchors

### Remote destinations (stubs, DRY_RUN on)
- [ ] `npx tsx scripts/capture.ts "Gym tomorrow at 9am"` → routes to Calendar, defaults Tier 2, prints stub payload with correct date
- [ ] `npx tsx scripts/capture.ts "Tier 1 prayer time tomorrow at 7am"` → routes to Calendar, picks up Tier 1 from input
- [ ] `npx tsx scripts/capture.ts "Buy groceries"` → routes to Tasks, prints stub payload
- [ ] `npx tsx scripts/capture.ts "What if I started a podcast about faith"` → routes to Idea Brain, prints formatted line with today's date

### Date parsing edge cases
- [ ] "tomorrow" → today + 1 day
- [ ] "next Friday" → resolves to a Friday in the next week (verify which one)
- [ ] A weekday name when today is that same weekday → script shows what it picked, user can correct
- [ ] Input with no date → date field is omitted, script asks if a date should be set

### Manual override
- [ ] Entering `n` at the classification prompt shows the destination list and lets you pick another
- [ ] Entering `q` exits cleanly with no writes

### DRY_RUN gate
- [ ] With `DRY_RUN=true`: no files are modified after any run, including local destinations
- [ ] With `DRY_RUN=false` on a prayer roster input: `config/prayer-roster.json` is actually updated and matches what the script previewed

---

*All four open questions are resolved. Waiting for Malachi's final "go" before any code is written.*
