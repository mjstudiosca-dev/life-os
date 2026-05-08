# Step 4.7 Spec — Morning Brief Polish

> **⚠️ SUPERSEDED 2026-05-05.** This step is now folded into
> `specs/step-5-webapp.md`. The brainstorm with Malachi pivoted away
> from polishing the email pipeline toward building the web app
> directly. Most items here (idea summaries, body context, reading-goal
> math, action handlers) are now v1 features of the web app instead of
> email-routine edits. The action-handler email-reply parser is dropped
> entirely — replaced by real buttons in the web app. Kept here for
> reference; do not build from this spec.

**Status:** SUPERSEDED. Picks up after Step 4.6 (Google Tasks).
**Depends on:** Step 4.5 (Supabase Idea Brain), Step 4.6 (Google Tasks)
**Out of scope:** Evening recap (Step 5), web app (Step 6)

---

## Why this exists

The brief works end-to-end (calendar + tasks + ideas + bible + prayer + practice).
But several rough edges showed up after the first runs:

1. Surfaced ideas paste a 100-char body excerpt — not a real summary
2. Practice goals like "Living Fearless (190 pages)" are static text — no
   page-per-day math
3. The four action options (Act today / Schedule / Push / Keep quiet) under
   each idea are decorative — nothing listens for a response
4. Gym and calorie tracking aren't captured anywhere — capture.ts has no
   classifications for them
5. The brief doesn't show gym streak / calorie context

This step closes those gaps without touching the bigger Phase 2 work
(web app). All of these stay inside the email + Cloud Routine + Supabase
architecture.

---

## Items

### 1. Summarize ideas AND tasks, don't paste

**Currently for ideas:** routine prompt says "first sentence of body,
truncated to ~100 characters". Result is robotic excerpts that often cut
mid-thought.

**Currently for tasks:** routine prompt only shows the title — task notes
aren't surfaced at all.

**Change:**
- For ideas: "summarize the idea in one line — capture the thesis or the
  action it implies, in your own words." Claude already has the full body
  in the query result.
- For tasks: when a Google Task has notes, summarize them in one line
  appended after the title (e.g. `• Buy AirTag for keys — for keychain
  tracker`). Skip the dash if no notes.

Both are wording changes to `routines/morning-brief.md` Step 7.

**Effort:** 5 min. No code, no schema.

### 2. Reading goal engine (page-per-day math)

**Generalized version of "Living Fearless 190 pages".**

**New table in Supabase** (`idea-brain` project):

```
reading_goals
  id            int4 PK
  title         text
  total_pages   int4
  current_page  int4 (default 0)
  target_date   date
  created_at    timestamptz
  updated_at    timestamptz
  status        text (default 'active')   -- 'active' | 'completed' | 'paused'
```

**On capture:** new classification in `capture.ts` for "I want to read
{book} by {date}" or explicit prompt — asks total pages, target date,
inserts row. (Or seed via Supabase Studio.)

**In `prep.ts`:** for each active reading goal, compute:
- `days_remaining = target_date - today`
- `pages_remaining = total_pages - current_page`
- `pages_today = ceil(pages_remaining / days_remaining)` (recomputed each day)
- `today_start = current_page + 1`
- `today_end = current_page + pages_today`

Add to `brief-payload.json` under a new `reading_goals` array.

**In the brief:** under the `📖 Practice & devotion` section, replace the
static `Living Fearless (190 pages)` line with:

```
• Living Fearless: pp. 47–53 today (28 days left, target Jun 30)
```

**Logging pages read** — new capture phrase: "read 7 pages of Living
Fearless" → updates `current_page`. Or evening recap (Step 5) prompts.

**Effort:** ~half day. New Supabase table + migration, new prep.ts logic,
brief format change, new capture handler.

### 3. Action handler — interim email-reply parser

**Problem:** the brief shows four actions per idea, but pressing them does
nothing.

**Interim solution (until Step 6 web app):** a small script that reads
unread Gmail threads with subject containing "Morning Brief", parses your
reply text, and applies the action.

**Reply format the parser accepts** (shown in the brief footer):

```
Reply to this email with one line per idea:
  act 6        → "Act today" on idea id 6
  sched 11 fri → "Schedule" idea 11 for next Friday
  push 14      → "Push to next week" on idea 14
  quiet 7      → "Keep quiet" idea 7 for 14 days
```

The parser:
- Uses Gmail MCP to fetch threads
- Extracts the user's most recent reply text
- Parses lines matching the patterns above
- Applies updates to the `ideas` table per PROJECT.md's action semantics
- Marks the email read

**Where it runs:** new Cloud Routine `Life OS Action Handler` on a 30-min
cron, or chained off the morning brief routine.

**Trade-off:** fragile (typos break it). Intentional: this is a stop-gap.
Web app replaces it cleanly in Step 6.

**Effort:** ~half day. New `scripts/handle-actions.ts` + new Cloud Routine.

### 4. Gym + calorie capture in capture.ts

**Two new classifications:**

- "trained {type} today" / "did push day" / "lifted today" / "cardio at lunch"
  → `workouts` destination
- "ate 2400 calories 180 protein" / "2400/180" / "hit 2200 today"
  → `calorie_log` destination

**New tables (Supabase):**

```
workouts
  id          int4 PK
  date        date
  type        text       -- 'lift' | 'cardio' | 'mobility' | 'rest' | 'other'
  notes       text (nullable)
  created_at  timestamptz

calorie_log
  id          int4 PK
  date        date
  calories    int4 (nullable)
  protein_g   int4 (nullable)
  notes       text (nullable)
  created_at  timestamptz
```

(Yes, this expands Supabase scope beyond the Idea Brain. Logged in
PROJECT.md decisions log. Justification: same-shape relational data
that JSON files would be awkward for once history accumulates.)

**Effort:** ~half day. Schema, capture handlers, prep.ts reads, brief
format updates.

### 5. Brief shows gym + calorie context

**In `prep.ts`:** read recent workout history (last 14 days) and calorie log
(last 7 days). Compute:
- Days since last workout
- This week's count vs. weekly target (5x/week from `routine.json`)
- 7-day average calories / protein vs. targets

**In the brief, new section** (only shows if there's relevant context):

```
🏋 Body
• Last trained: 2 days ago (push day)
• This week: 3 / 5 sessions
• 7-day avg: 2,380 cal / 175g protein (target 200g — eat more)
```

**Effort:** ~2 hours. New brief section + format rules.

---

## Files modified or created

**New:**
- Supabase migrations: `reading_goals`, `workouts`, `calorie_log` tables
- `scripts/handle-actions.ts` — email-reply action parser
- (Possibly) `scripts/seed-reading-goal.ts` — quick CLI to add a reading goal

**Modified:**
- `scripts/capture.ts` — three new classifications + handlers
- `scripts/prep.ts` — pulls reading-goal math, gym/calorie context, includes
  in `brief-payload.json`
- `routines/morning-brief.md` — idea-summary wording, new `🏋 Body` section,
  reading-goal line, footer with reply format for action handler
- `PROJECT.md` — Phase 1 build plan now mentions Step 4.7
- `BUILD_LOG.md` — Step 4.7 section logging decisions

**Cloud Routines:**
- New: `Life OS Action Handler` (30-min cron, runs `scripts/handle-actions.ts`)

---

## Open questions to resolve before building

1. **Action handler cadence**: every 30 min vs. once mid-morning vs. on-demand?
2. **Reading goals — single book or multiple at a time?** v1 supports many but
   brief might show only the top 1–2 to keep emails short.
3. **Workout types**: free-form text or controlled vocabulary? Free-form is
   easier to capture; vocabulary makes brief logic ("you haven't done legs in
   a week") cleaner.
4. **Calorie format flexibility**: parse "2400/180", "2400 cal 180 protein",
   "2.4k 180g" all as the same input? Just one canonical format to start?

---

## Verification (manual checklist)

- [ ] Idea summaries: brief shows real summaries, not pasted excerpts
- [ ] Reading goal: `Living Fearless: pp. X–Y today (N days left)` appears
  with correct math; logging "read 7 pages" updates `current_page`
- [ ] Action handler: replying to the brief with `act 6` marks idea 6's
  status as expected; idempotent on repeated runs
- [ ] Gym capture: `npx tsx scripts/capture.ts "trained push today"` → row in
  `workouts`; brief shows updated streak the next morning
- [ ] Calorie capture: `npx tsx scripts/capture.ts "2400 cal 180 protein"` →
  row in `calorie_log`; brief averages reflect the entry
- [ ] All on Cloud Routine: morning run still produces a clean Gmail draft
  with all the new sections

---

## What's next after this

Step 5 — Evening recap + miss handling (already specced, brings bible
advancement, prayer last_surfaced updates, evening calorie/gym prompts,
miss-handling per tier).

Then 2-week MVP soak per PROJECT.md's build principle.

Then Step 6 — the web app (see `specs/step-6-web-app.md`).
