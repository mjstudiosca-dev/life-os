# Manual Test Checklist

Mark each item with `[x]` when verified.

---

## Step 1 — Foundation

### 1. Config files exist and parse as valid JSON

```bash
node -e "require('./config/routine.json')"
node -e "require('./config/prayer-roster.json')"
node -e "require('./config/bible-plan.json')"
node -e "require('./config/tiers.json')"
node -e "require('./config/flags.json')"
node -e "require('./state/idea-rotation.json')"
node -e "require('./state/reading-progress.json')"
```

- [ ] `config/routine.json` — exists, parses without error
- [ ] `config/prayer-roster.json` — exists, parses without error, contains 9 people
- [ ] `config/bible-plan.json` — exists, parses without error, contains 4 tracks
- [ ] `config/tiers.json` — exists, parses without error, contains 3 tiers
- [ ] `config/flags.json` — exists, parses without error, DRY_RUN is true
- [ ] `state/idea-rotation.json` — exists, parses without error
- [ ] `state/reading-progress.json` — exists, parses without error

### 2. TypeScript compiles without errors

```bash
npm install
npm run typecheck
```

- [ ] `npm install` completes with no errors
- [ ] `npm run typecheck` exits with no errors

### 3. .gitignore is correct

- [ ] `node_modules/` is listed
- [ ] `.env` is listed
- [ ] Confirm `.env` does NOT appear in `git status` after running `npm install`

### 4. Repo pushes to origin/main successfully

- [ ] `.env` is absent from staged files
- [ ] Push succeeds with no errors

### 5. BUILD_LOG.md has at least one entry

- [ ] `BUILD_LOG.md` exists and contains a dated entry

### 6. README.md describes the project

- [ ] `README.md` exists and gives a reader enough context to understand what this repo is

---

## Step 2 — Capture + Routing

All Step 2 tests must be run in a real interactive terminal — the script uses
`readline` prompts which do not work cleanly with piped stdin.

### Setup

- [ ] `npm install` succeeds (chrono-node should already be in `dependencies`)
- [ ] `npm run typecheck` exits clean
- [ ] `config/flags.json` has `DRY_RUN: true`
- [ ] `.env` has `IDEA_BRAIN_SUPABASE_URL` and `IDEA_BRAIN_SUPABASE_SERVICE_ROLE_KEY` set (gitignored)

### Classification — confirm the best-guess destination for each input

For each input below, run:
```bash
npx tsx scripts/capture.ts "<input>"
```
and verify the "Best guess:" line. Press `q` to exit without writing.

- [ ] `"Hayden has a job interview Tuesday"` → Prayer roster
- [ ] `"Pray for Hayden's job search"` → Prayer roster
- [ ] `"Pray for Mom's surgery Thursday"` → Prayer roster
- [ ] `"Pray for Coach Davis on Friday"` → Prayer roster
- [ ] `"Gym tomorrow at 9am"` → Calendar
- [ ] `"Sunday service every week Tier 1"` → Routine — anchor
- [ ] `"Memorize Philippians 4:13 this week"` → Routine — practice goal
- [ ] `"Buy groceries"` → Tasks
- [ ] `"What if I started a podcast about faith"` → Idea Brain

### Manual override

- [ ] On any classified input, pressing `n` shows a numbered destination list
- [ ] Picking a number routes to that destination's flow
- [ ] Pressing `q` from the destination list exits cleanly

### Prayer roster — full flow (DRY_RUN on)

- [ ] `"Hayden has a job interview Tuesday"` → Stage 1 confirms; situation guess is shown; entry preview shows `type: "date_anchored"`, `date: "2026-04-28"`, name reuses `"Hayden"`; DRY RUN notice prints
- [ ] `"Pray for Hayden's job search"` → entry preview shows `type: "ongoing"` (no date field); DRY RUN notice prints
- [ ] `"Pray for Coach Davis on Friday"` → script asks to add new person, prompts for relation and situation, then shows formatted `date_anchored` entry
- [ ] `"pray for Hayden"` (no situation, no date) → prompts "add specific situation? [y/n]"; entering `n` exits; entering `y` then a situation produces an `ongoing` entry

### Calendar — full flow (DRY_RUN on, stub fires)

- [ ] `"Gym tomorrow at 9am"` → Tier 2 default; Stage 2 shows payload with correct date, time `09:00`; `[STUB] connectors/calendar.ts → createCalendarEvent` prints with the payload
- [ ] `"Workout tomorrow at 9am Tier 1"` → Tier 1 picked up from input

### Tasks — full flow (Google Tasks)

- [ ] `.env` has `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_TASKS_REFRESH_TOKEN` (gitignored)
- [ ] `DRY_RUN=true npx tsx scripts/capture.ts "Buy groceries"` → Stage 2 shows payload with `dueDate: null`; DRY RUN notice prints (no real write)
- [ ] `DRY_RUN=false npx tsx scripts/capture.ts "Buy groceries"` → real Google Tasks entry "Buy groceries" appears in the user's default tasklist within seconds; CLI prints `→ Created task id <gtasks-id>`
- [ ] `DRY_RUN=false npx tsx scripts/capture.ts "Email coach about contract by Friday"` → task is created with `due` set to the upcoming Friday's ISO date

### Tasks migration — one-time TODO → Google Tasks

- [ ] `DRY_RUN=true npx tsx scripts/migrate-todos-to-gtasks.ts` → prints the list of active TODO-category Supabase rows but does not write
- [ ] `DRY_RUN=false npx tsx scripts/migrate-todos-to-gtasks.ts` → each row becomes a Google Tasks entry; corresponding `ideas` row has `status = 'archived_to_gtasks'` and `external_ref = '<gtasks-id>'`
- [ ] Re-running with `DRY_RUN=false` immediately after → script reports "No active TODO-category rows to migrate" (idempotent)
- [ ] Verify in Supabase: `SELECT count(*) FROM ideas i JOIN idea_categories ic ON ic.idea_id=i.id JOIN categories c ON c.id=ic.category_id WHERE c.name='TODO' AND i.status='active'` returns 0

### Idea Brain — full flow (DRY_RUN on)

- [ ] `"What if I started a podcast about faith"` → Stage 2 shows `{ title, body, status, is_time_anchored, source }`; DRY RUN notice prints (no real Supabase write)
- [ ] `"What if I memorized one verse this week"` → `is_time_anchored: true` due to "this week"
- [ ] `"Buy groceries... wait, that's a task"` → classified as Tasks, not Idea Brain (verifies classification still works)
- [ ] With `DRY_RUN=false` and valid Supabase creds in `.env`: same input creates a row in the `ideas` table — verify in Supabase Studio

### Routine writes — anchor + practice goal (real local writes when DRY_RUN off)

These tests run twice: once with `DRY_RUN=true` (verify nothing changes), once with `DRY_RUN=false` (verify file is updated).

- [ ] `DRY_RUN=true npx tsx scripts/capture.ts "Sunday service every week Tier 1"` → prints DRY RUN notice; `routine.json` is unchanged
- [ ] `DRY_RUN=false npx tsx scripts/capture.ts "Sunday service every week Tier 1"` → `routine.json` now has a new entry in `anchors[]` matching the previewed JSON

### Prayer roster — real local write (DRY_RUN off)

- [ ] `DRY_RUN=false npx tsx scripts/capture.ts "Hayden has a job interview Tuesday"` (and confirm at every prompt) → `config/prayer-roster.json` has a new entry appended; original 9 entries are unchanged

### Date parsing edge cases

- [ ] `"Gym tomorrow at 9am"` → date resolves to today + 1, time `09:00`
- [ ] `"Lunch next Friday"` → date resolves to a Friday in the next week
- [ ] `"Coffee at 3pm"` → date resolves to today (since no day given)

### DRY_RUN gate (with the value left at default `true` in `.env`)

- [ ] After every test above run with default `.env`: every JSON config file's contents are unchanged from before the test run

---

## Step 3 — Routine + Plan Generation

### Setup
- [ ] `npm run typecheck` passes
- [ ] `state/brief-payload.json` is listed in `.gitignore`

### Basic run
- [ ] `npx tsx scripts/prep.ts` exits with one-line confirmation
- [ ] `state/brief-payload.json` exists and parses as valid JSON
- [ ] `generated_at`, `date`, `day_of_week`, and `timezone` are all present and correct

### Bible readings
- [ ] `proverbs` = `"Proverbs {day-of-month}"` (e.g. `"Proverbs 28"` on April 28)
- [ ] `psalms` = a range covering 5 psalms for today (e.g. `"Psalms 136–140"` on April 28)
- [ ] `gospels.reading` = `"Mark 5"` (matches `state/reading-progress.json`)
- [ ] `isaiah.reading` = `"Isaiah 10"` (matches `state/reading-progress.json`)
- [ ] `gospels.days_until_end` = 11 (Mark 16 − Mark 5)
- [ ] `isaiah.days_until_end` = 56 (Isaiah 66 − Isaiah 10)

### Prayer roster
- [ ] `ongoing_rotation` has exactly 3 entries
- [ ] All 3 have `type: "ongoing"` in the source file
- [ ] `date_anchored` is empty (no entries with today's date in the roster)
- [ ] Manually add a `date_anchored` entry with today's date to `prayer-roster.json`, re-run — it appears in `date_anchored[]` (then revert the change)

### Practice goals
- [ ] `practice_goals` is `[]` (routine.json currently empty)
- [ ] Manually add a goal to `routine.json`, re-run — it appears in the payload (then revert)

### Idempotency
- [ ] Running `npx tsx scripts/prep.ts` twice in a row produces the same payload (apart from `generated_at` timestamp)

### No side effects
- [ ] `config/prayer-roster.json` is unchanged after any run
- [ ] `state/reading-progress.json` is unchanged after any run (progress never advances in prep.ts)
