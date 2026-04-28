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
