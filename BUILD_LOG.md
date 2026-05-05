# Build Log

Running record of implementation decisions for the Life OS project.

---

## 2026-04-27 — Step 1: Foundation

**Decision: TypeScript**
Chosen for strict type safety on data structures (config schemas, state files) that will be read and written by multiple scripts. Strict mode enforced in tsconfig. Runtime execution via `tsx` to avoid a build step during development.

**Decision: JSON for config files**
Human-editable without tooling. Easy to validate with `node -e "require(...)"`. Machine-writable by future scripts. Comments not supported natively — where comments are needed (flags.json), a `_comment` key is used as a convention.

**Decision: DRY_RUN in both .env and config/flags.json**
`.env` is the runtime source of truth (gitignored, environment-variable-friendly for eventual Cloud Routine background execution). `config/flags.json` holds committed safe defaults and serves as documentation. Scripts will read `.env` first, fall back to `flags.json`. Default is always `true` — no accidental writes.

**Decision: Type-specific schemas in bible-plan.json**
`date_match` and `monthly_full` tracks derive position from the calendar — no stored `current_position`. `sequential` tracks store `current_position` and `end_position` explicitly. Avoids null fields on tracks where position is meaningless.

**Decision: Richer tiers.json schema**
Tiers stored as objects with `id`, `label`, `description`, `movable`, and `system_behavior` fields rather than plain strings. Future scripts can branch on `movable` without parsing description text.

**Open questions for Step 2:**
- Which MCP connector do we wire first — Calendar or Gmail?
- How does the morning brief script receive the composed output? (stdout, Gmail draft, both?)
- How will the idea brain Google Doc be scoped / chunked for reading?

---

## 2026-04-28 — Step 3: Routine + Plan Generation

**Decision: Single output file — state/brief-payload.json**
Prep writes one JSON snapshot per run, overwriting any previous file. Step 4
reads it. File is gitignored — it's a daily build artifact, not state worth
tracking.

**Decision: Psalms distributed proportionally across month length**
Formula: `start = floor(((day-1)/daysInMonth) * 150) + 1`, `end = floor((day/daysInMonth) * 150)`.
Works correctly for any month length (28–31 days) without special cases. April
28 → Psalms 136–140.

**Decision: Reading progress never advances in prep.ts**
Sequential tracks (Gospels, Isaiah) are read from state/reading-progress.json
as-is. Advancing the position only happens after Malachi confirms reading at
evening recap (Step 5).

**Decision: 3 ongoing prayer entries per run**
Fixed count per Malachi's instruction. If fewer than 3 exist, all are shown.
Rotation priority: null last_surfaced first, then oldest date. last_surfaced
is not written by prep.ts — only updated in Step 5 after the brief fires.

**Decision: days_until_end is chapters remaining AFTER today's reading**
`chaptersRemaining = end_chapter - current_chapter`. At 0, today is the final
chapter. Warning prints to console when ≤ on_completion_prompt_days_before.

**Decision: Timezone recorded in payload**
`localTimezone()` uses `Intl.DateTimeFormat().resolvedOptions().timeZone`.
Included in the payload so Step 4 can reference it. Timezone-aware scheduling
is a Step 5 concern (noted in BACKLOG.md).

---

## 2026-04-28 — Step 2: Capture + Routing

**Decision: Single capture script (`scripts/capture.ts`)**
One entry point for all input. Classifies, confirms with the user, then writes
to the right destination. Each destination has a per-handler flow but all
writes go through a shared `gateAndWrite` that respects `DRY_RUN`.

**Decision: chrono-node for natural language date parsing**
Adding the `chrono-node` dependency. Pre-discussed and approved; rolling our
own date parsing for inputs like "next Tuesday", "tomorrow at 9am" is a known
trap.

**Decision: Remote connectors are stubs in Step 2**
`connectors/calendar.ts`, `connectors/tasks.ts`, `connectors/drive.ts` log
their structured payloads instead of making real MCP calls. Their input types
(`CalendarEventInput`, `TaskInput`, `DriveAppendInput`) are locked now so
Step 4 can swap the bodies without changing capture.ts. Reason: capture.ts
runs as a standalone Node script via `npx tsx`, which has no MCP access. Real
calls happen in Step 4 inside Claude Code.

**Decision: Prayer roster — append a new entry for each capture, never modify existing**
PROJECT.md §2 says "Hayden has a job interview Tuesday → adds date-anchored
entry." We append a new entry that shares the existing `name: "Hayden"` so a
single name filter retrieves all of Hayden's prayer requests. The seeded
`ongoing` baseline is never touched. Person-not-in-roster captures prompt for
relation + situation before adding. Earlier draft of the spec used a
`current_situation` field on the existing entry — discarded because it
contradicted §2.

**Decision: Prayer entry shape — same as Step 1 seed plus optional `date`**
No schema migration. Existing entries (`name`, `relation`, `situation`,
`type`, `last_surfaced`) are unchanged. New `date_anchored` entries add a
`date` field on top of that.

**Decision: Anchor schema** — `{ label, recurrence_text, tier, added }`. The
recurrence is stored as the user's verbatim phrase ("every Sunday") rather
than parsed into a structured RRULE — Step 4 can parse it later if needed.

**Decision: Practice goal schema** — `{ label, scope, added }`. `scope` is the
verbatim phrase like "this week" or `null` if no scope was given.

**Decision: Idea Brain line format** — `- YYYY-MM-DD — {raw input}`. Date
prefix keeps the doc scannable. Raw input preserves the user's exact wording.

**Decision: Tier inference** — default to Tier 2; explicit "Tier 1" or
"Tier 3" anywhere in the input overrides. Stage 1 always shows the inferred
tier so the user can correct it via the manual override flow.

**Decision: Classification rule order is intentional, not perfect**
Prayer keyword fires first, so an input like "Tier 1 prayer time tomorrow at
7am" classifies as Prayer roster even though the user may have meant a
calendar event. The `n` manual override exists exactly for this case. We
prefer false positives that the user can re-route over false negatives that
silently land in Idea Brain.

**Decision: Anchors route to Google Calendar as recurring events, not routine.json**
Original spec stored anchors in `routine.json`. Changed after Malachi confirmed
the intent: "Sunday service every Sunday Tier 1" should create a weekly
recurring Calendar event, not a local JSON record. Reasons: (1) Calendar is
already the Step 4 data source for the morning brief — storing anchors there
means no extra read path; (2) Google Calendar handles recurrence natively via
RRULE. `routine.json` anchors array stays in schema but capture no longer
writes to it. `CalendarEventInput` gains a `recurrence` field (RRULE string or
null); one-off events pass `recurrence: null`.

**Decision: Anchor start date = next occurrence of specified day, never today**
chrono was being used on the full anchor input, which produced "tomorrow" for
"Sunday service every Sunday." Anchors now use a dedicated `nextOccurrence()`
helper that finds the soonest upcoming day matching the recurrence pattern.

**Decision: Readline `ERR_USE_AFTER_CLOSE` swallowed in main's catch handler**
`readline/promises` rejects later prompts when stdin is piped (lines run out,
EOF closes the interface). Real interactive use never hits this; piped tests
do. We treat it as a clean exit so testing scripts don't appear to crash.

---

## 2026-04-29 — Step 4: Morning Brief

**Decision: Cloud Routine over standalone TypeScript script (Option A)**
The brief is composed inside a remote Claude Code session, not a Node script
calling Google APIs directly. The routine clones the repo each run, executes
`prep.ts` via Bash, then uses MCP tools (Calendar, Drive, Gmail) to assemble
and draft the email. Reasons: (1) MCP infrastructure already exists, no OAuth
plumbing to maintain; (2) one place handles scheduling, composition, and
sending; (3) prompt lives in the repo so changes ship with `git push`.

**Decision: Routine prompt is a one-liner pointing to the file**
The routine's embedded prompt is:
`Read 'routines/morning-brief.md' from the repo root and follow those
instructions exactly.`
The full 9-step instructions live in `routines/morning-brief.md`. Reason: lets
Malachi edit the brief format/behavior with a normal git workflow — no
touching the routine config on claude.ai. Routine clones fresh each run so
edits take effect immediately.

**Decision: Tasks step is optional**
Step 4 of the routine prompt says: "If the Tasks MCP tool is not available,
skip this step and omit the Tasks section." Reason: Google Tasks doesn't have
an official Anthropic MCP connector yet — Malachi would need to build a custom
MCP server. Rather than block the brief on that, the section gracefully drops
when the tool is missing.

**Decision: Hours open = 16 minus all calendar events (Tier 1 + Tier 2)**
Resolved Q4 in the spec. Reason: Tier 2 commitments aren't "locked" but they
do consume time the user has committed to something. Tier 3 is purely
optional, so it doesn't count against open hours.

**Decision: Ideas — up to 3 total, time-anchored first**
Resolved Q2 in the spec. Time-anchored entries (this week / by Friday /
explicit dates / "soon" / today's date) always surface first. Remaining slots
filled with rotating picks, varied day-to-day. Hard cap of 3.

**Decision: Tasks get their own section, not mixed into tiers**
Resolved Q3. Reason: tasks have no tier assigned at capture (only Calendar
events do). Inferring tier from text was rejected as too unreliable. Own
section is honest about what they are.

**Decision: GitHub Integration must be connected via claude.ai web UI**
Initial create attempts via RemoteTrigger API set the git URL to
`https://github.com/...` or `https://ssh.github.com/...` — runs failed to
start or cloned an empty repo. Root cause: the routine UI uses a
GitHub-integrated repo picker (claude.ai/settings/connectors → GitHub
Integration → Connect). Without that connection, no git URL set via API
works. Once connected, the picker shows the repo, the routine attaches it
properly, and runs succeed.

**Decision: brief-payload.json is gitignored**
Already established in Step 3 but reaffirmed: it's a per-run build artifact,
not state worth versioning. The Cloud Routine regenerates it via `prep.ts`
every morning.

**Decision: First successful run shape (2026-04-29 dry run)**
5 Tier 2 events, 0 Tier 1, 0 Tier 3, 3 ongoing prayer names, Tasks section
omitted (no MCP), Idea Brain empty (no entries yet). Gmail draft created at
mjstudiosca@gmail.com under DRY_RUN=true. Confirmed format reads correctly.

---

## 2026-04-29 — Step 4.5: Idea Brain → Supabase

**Decision: Idea Brain moves from Google Doc → Supabase**
Reverses PROJECT.md §2 "No DB" for the Idea Brain only. Reasons:
- Need real relational features: many-to-many categories, cross-links between
  ideas, per-idea surface history (`surface_count`, `last_surfaced_at`,
  `surface_log` audit table).
- Need fast filtered queries that distinguish time-anchored, scheduled, and
  rotating ideas without reading the whole archive into context.
- The four action options (Act today / Schedule / Push / Keep quiet) need
  durable state on each row — a Doc can't model that cleanly.

**Decision: Supabase scope is limited to the Idea Brain**
All other state (prayer roster, bible plan, reading progress, routine config,
flags) stays as JSON config + JSON state + markdown logs. The DB rule only
relaxes for the Idea Brain.

**Decision: Schema (verified against the live DB via Supabase MCP)**
- `ideas` (id **int4 PK**, title, body, status, scheduled_for, due_date,
  priority, last_surfaced_at, surface_count, is_time_anchored, source,
  external_ref, created_at, updated_at)
- `categories` (id int4 PK, name unique, description)
- `idea_categories` (idea_id int4, category_id int4) — composite PK
- `idea_connections` (id int4 PK, from_idea_id, to_idea_id, note)
- `surface_log` (id int4 PK, idea_id, surfaced_at, context)

`ideas.id` is **integer**, not UUID. The original migration prompt suggested
`ARRAY['...']::uuid[]` — corrected to `ARRAY[1, 2, 3]::int[]` in
`routines/morning-brief.md`. The seven seeded categories: `PERSONAL`,
`AI BIZ`, `TORCH`, `MESSAGE`, `TODO`, `MINISTRY`, `NEXT PROJECT`.

**Verified state at migration time (2026-04-29):**
- 14 ideas (not 13), all `status = 'active'`, mostly `source = 'reminders_migration'`
- 17 idea-category links, 11 idea connections, 0 surface_log rows
- One idea (id 6, "Migrate app exercises to Google Sheet") has
  `due_date = 2026-04-27` — already past today (2026-05-02). Query A excludes
  past-due, so it won't surface as time-anchored. Open question: should
  past-due be surfaced as overdue? Logged as a Step 5 question.

**Decision: Two new env vars**
`IDEA_BRAIN_SUPABASE_URL`, `IDEA_BRAIN_SUPABASE_SERVICE_ROLE_KEY`. Both
gitignored via `.env`. Service-role key used because all writes are first-party
(personal system, no end users). When the Cloud Routine needs them, they're
attached via the Supabase MCP connector — the routine never sees the raw key.

**Decision: Cloud Routine queries Supabase via MCP, not HTTP**
The morning-brief routine uses the Supabase MCP `execute_sql` tool. Two
queries: time-anchored first (always surface), then a `RANDOM() LIMIT 3`
rotating pick filtered to ideas not surfaced in the last 2 days. After
composing the brief, the routine updates `last_surfaced_at`, increments
`surface_count`, and inserts into `surface_log` for each surfaced idea.

**Decision: Local capture uses HTTP, not @supabase/supabase-js**
`scripts/capture.ts` writes via `fetch()` to PostgREST (`/rest/v1/ideas`).
Reason: avoids adding a dependency for a single insert call. Keeps the
package surface minimal as PROJECT.md requires.

**Decision: Capture splits input into title + body heuristically**
First sentence (or first ~80 chars at a word boundary) → `title`; the rest →
`body`. Categories aren't assigned by the script — set them in Supabase Studio
or the iOS Shortcut path. Reason: tagging requires the full category list,
which doesn't belong inline in a quick capture flow.

**Decision: `is_time_anchored` pre-flag in capture**
The script flips `is_time_anchored = true` when input contains "this week",
"by [day]", "soon", "upcoming", "today", "tomorrow", or "tonight". Cheap
pattern match. The DB column is the source of truth — the iOS Shortcut /
Studio can override.

**Decision: 13 existing ideas migrated outside this conversation**
Migration was done in another tool. Schema in this build_log mirrors what's in
the DB; if drift appears, the DB wins. To verify, run a Supabase MCP
`list_tables` against the `idea-brain` project.

**Decision: Old Google Doc retained as one-way archive**
We don't read from it anymore (`flags.json` no longer carries
`IDEA_BRAIN_DOC_ID`; capture no longer appends to it). The Doc is left in
place rather than deleted — read-only fallback if Supabase is ever
unavailable. iOS Shortcut update (Doc → Supabase POST) is on Malachi's side.

**Decision: Action handlers (Act today / Schedule / Push / Keep quiet)
deferred to Step 5 / evening recap**
The morning brief renders the four options as literal text under each idea so
Malachi can reply via email or pick during the evening recap. No handler is
wired in Step 4.5 — the brief simply surfaces.

**Decision: Tasks MCP work paused**
Was mid-setup (OAuth credentials being recreated, Path A vs Path B
unresolved). Paused to ship the Idea Brain migration first since it
unblocks today's brief. Tasks MCP picks back up after this lands.
