# Life OS — PROJECT.md

> **This is the source of truth for the Life OS build.**
> Every Claude Code session reads this file first. Update this file as the project evolves.

**Owner:** Malachi Jarrett
**Repo:** github.com/mjstudiosca-dev/life-os
**Status:** Phase 1 in progress. Steps 1–3 ✅ complete. Step 4 next.
**Last updated:** April 27, 2026

---

## How This Document Works

This file is a living document, not a frozen spec. It has six sections:

1. **Vision & principles** — the why, doesn't change often
2. **Locked decisions** — things that shouldn't be re-debated unless real evidence appears
3. **Architecture** — stack, file structure, conventions
4. **Phase 1 build plan** — Steps 1–5 in detail
5. **Backlog** — ideas not yet specced, parking lot for new thoughts
6. **Open questions & decisions log** — things to decide; record of past decisions

When Claude Code reads this file, it follows the rules in the **Working Rules** section near the bottom.

---

## 1. Vision

A personal life operating system. Every morning Malachi gets a unified brief — calendar, tasks, routines, surfaced ideas, practice goals, Bible reading, and people he's praying for — formatted as a daily menu of options, not a rigid schedule. Three priority tiers govern what's locked, what's movable, and what's optional. Evening recap handles misses based on tier. New input gets routed to the right system based on what it is.

### The morning brief shape

```
Good morning. Today is [date].

🔒 Locked in (Tier 1)
[calendar items]

📌 Plan today (Tier 2)
[planned blocks]

🎯 Available if you want it (Tier 3)
[optional blocks]

📖 Practice & devotion
• Bible reading: [today's portion]
• Verse of the week: [verse]
• Reading: [book + chapter]

🙏 Praying for
• [name] — [situation, date if relevant]

💡 From your idea brain
• [time-anchored ideas first]
• [rotating surprise picks]

🌟 You have ~X hours open. No pressure.
```

### Build principle

Ship the smallest reliable loop. Risk isn't code — risk is abandonment from over-engineering. Run MVP for 2 weeks before adding anything to it.

---

## 2. Locked Decisions

These have been made. Don't re-debate without real reason.

### Identity & cadence
- **Morning brief:** delivered via email at 6:00 AM
- **Evening recap:** delivered at 8:00 PM
- **Capture surface:** iOS Shortcut → POSTs to Supabase `ideas` table (the "Idea Brain"). Local fallback: `scripts/capture.ts` writes to the same table.

### Stack
- **Language:** TypeScript on Node 20+
- **Storage:** GitHub repo for code/config; Supabase (`idea-brain` project, ID `nifkdviqtwokroxvkxzw`) for the Idea Brain only
- **Scheduling:** Cloud Routines in Claude Code (works when laptop is off, confirmed available on Pro plan)
- **Integrations:** Gmail, Google Calendar (claude.ai connectors); Google Tasks (custom MCP server in `mcp-servers/google-tasks/`); Supabase (claude.ai connector, for the Idea Brain). Connectors attach to each routine via `claude.ai/customize/connectors` + the routine config.
- **DB scope:** Supabase is **only** for the Idea Brain (rich relations: categories, connections, surface tracking). Everything else stays as JSON config + JSON state + markdown logs.

### Priority tiers

| Tier | Name | Rule | Examples |
|------|------|------|----------|
| 1 | Anchors | Don't move | Classes, paid shoots, Torch shifts, Sunday service, sleep |
| 2 | Commitments | Movable within day, not across | Gym, deep work, food prep, devotion, practice goals |
| 3 | Intentions | Movable freely, droppable | Reading, side-projects, errands |

Miss handling at evening recap:
- **Tier 1 missed** → real conversation, not a checkbox
- **Tier 2 missed** → reschedule / drop / push
- **Tier 3 missed** → quietly drops unless flagged

### Bible plan

Four parallel tracks. Each morning shows the next reading from each.

| Track | Type | Rule | Current position |
|-------|------|------|------------------|
| Proverbs | Date-match | Chapter = day of month | Loops monthly |
| Psalms | Monthly-full | Complete the book each calendar month (~5/day) | Loops monthly |
| Gospels | Sequential | One chapter/day, walks Mark → ? | Mark 5 (next read) |
| Isaiah | Sequential | One chapter/day | Isaiah 10 (next read) |

**On track end:** system prompts 2 days before any sequential track ends asking what to read next. No pre-decided order.

### Prayer roster

Seeded with 9 ongoing entries: Brother, Sister, Mom, Dad, Trent, Layton, Hayden, Lewis, Ian. All placeholder situation = "safe travel" until updated. All marked `ongoing: true`.

Behaviors:
- Ongoing entries rotate 3–5/morning
- Date-anchored entries surface on the relevant date
- Time-bound entries auto-archive after the date passes (unless `ongoing: true`)
- Capture: "Hayden has a job interview Tuesday" → adds date-anchored entry
- Update: "Dad's recovery is going well" → updates situation field on existing entry
- Evening recap can prompt "any updates on the people you're praying for?"

### Health/routine

- **Workouts:** flexible tracking, 5x/week minimum, lifting + cardio, ~1000 cal burn target, 200g protein
- **Tracking method:** evening recap asks "did you train today?"
- **Calorie tracking:** prompts at evening recap, never moralizes. Logging in real app. Framing: energy, training, fueling well.
- **Wake-up:** Tier 1, generated daily from routine config

### Practice goals — phase 1 simple version

Each goal has: name, current content, display rule. Brief surfaces them. Malachi does the practice. No state tracking, rotation, or generation in Phase 1.

Examples in scope:
- Verse of the week
- Reading: current book + chapter

### Idea surfacing logic

The Idea Brain is a Supabase database (`idea-brain` project, ID `nifkdviqtwokroxvkxzw`). Schema (verified against the live DB on 2026-04-29):

- **`ideas`**: `id` (int4 PK), `title` (text), `body` (text, nullable), `status` (text, default `'active'`), `scheduled_for` (date, nullable), `due_date` (date, nullable), `priority` (text, nullable), `last_surfaced_at` (timestamptz, nullable), `surface_count` (int4, default 0), `is_time_anchored` (bool, default false), `source` (text, nullable), `external_ref` (text, nullable), `created_at` / `updated_at` (timestamptz)
- **`categories`**: `id` (int4 PK), `name` (text, unique), `description`, `created_at`. Current rows: `PERSONAL`, `AI BIZ`, `TORCH`, `MESSAGE`, `TODO`, `MINISTRY`, `NEXT PROJECT`
- **`idea_categories`**: M:N join (`idea_id`, `category_id`)
- **`idea_connections`**: cross-links between ideas (`from_idea_id`, `to_idea_id`, `note`)
- **`surface_log`**: audit trail (`idea_id`, `surfaced_at`, `context`)

RLS is enabled on all tables. The service-role key bypasses RLS, which is what capture and the morning brief use.

Two .env keys required: `IDEA_BRAIN_SUPABASE_URL`, `IDEA_BRAIN_SUPABASE_SERVICE_ROLE_KEY`.

- **Layer 1 — Time-anchored** (always surface): rows with `is_time_anchored = TRUE`, OR `due_date` ∈ {today, tomorrow}, OR `scheduled_for = today`
- **Layer 2 — Rotating surprise:** rows where `is_time_anchored = FALSE`, not scheduled today, `last_surfaced_at` is null OR > 2 days ago, ordered by `RANDOM()`, limit 3
- Hard cap of 3 ideas surfaced per morning brief (time-anchored first, rotating filling the rest)

After surfacing, the routine updates each surfaced row: `last_surfaced_at = NOW()`, `surface_count += 1`, plus an `INSERT` into `surface_log` with `context = 'morning_brief'`.

Action options on each surfaced idea (rendered as text in the brief; user replies to trigger):
1. **Act today** → create a task/block; idea stays `status = 'active'` (still in rotation)
2. **Schedule** → set `scheduled_for = <chosen date>`, `status = 'scheduled'`
3. **Push to next week** → `scheduled_for = today + 7`, `status = 'scheduled'`
4. **Keep quiet** → `last_surfaced_at = NOW() + INTERVAL '14 days'` (suppresses rotation for 2 weeks)

**No dismiss option.** Ideas are seeds, not chores.

**Action handlers** are processed in the evening recap or via email-reply parsing (Step 5+). The morning brief itself only surfaces and updates `last_surfaced_at` / `surface_count` / `surface_log`.

### Tasks vs Ideas — clean split

Tasks and ideas are different things and live in different systems:

| Surface | Source of truth | Capture | Completion UX |
|---------|-----------------|---------|---------------|
| **Tasks** ("Wash backpack", "Buy AirTag") | **Google Tasks** | `scripts/capture.ts` → `connectors/tasks.ts`; iPhone Google Tasks app | Native Google Tasks app (tap to check) |
| **Ideas** ("Summer planning system", "Sabbath message") | **Supabase `ideas`** | `scripts/capture.ts` → Supabase POST; iOS Shortcut (later) | Email reply → action handler (Step 5+) |

The morning brief surfaces them in two separate sections:
- `📋 Tasks` reads Google Tasks via the custom MCP server (`mcp-servers/google-tasks/`)
- `💡 From your idea brain` reads Supabase via the Supabase MCP, **excluding `TODO`-categorized rows** (those are tasks now)

The `TODO` category in Supabase is deprecated. Existing rows were migrated to Google Tasks via `scripts/migrate-todos-to-gtasks.ts`; their Supabase rows were marked `status = 'archived_to_gtasks'` (so they don't surface) with `external_ref` pointing back to the Google Tasks task id.

### Safety rules

- All write actions to Gmail/Calendar/Tasks gated behind `DRY_RUN` flag, default `true`
- `DRY_RUN` only flips to `false` after Step 5 ships AND Malachi has eyeballed real outputs and approved
- Each script reads only the slice of data it needs — never load full archives into context
- No external dependencies beyond what's needed; minimal package surface

### Travel calendar (informational, not for system logic)

These are the major fixed blocks Malachi has on his calendar. The system will read them through the Calendar connector once that's wired. Listed here for context.

- **May 1–2:** Home (California)
- **May 2–6:** Disneyland
- **May 7:** Fly Birmingham, friend's house overnight
- **May 8–18:** Brazil (Light to the Nations missions trip)
- **May 18:** Fly back
- **May 19–20:** Home
- **May 21–24:** JH Ranch ($250/day work)
- **May 25+:** Church production work, home base
- **July 1–5:** Girlfriend's birthday trip (location TBD, dates adjustable)
- **TBD:** Hawaii

### Removed from scope

- **Worship song surfacing:** considered, removed at user request. Don't add back unless Malachi brings it up.

---

## 3. Architecture

### Repo structure

```
life-os/
├── PROJECT.md                # This file. Source of truth.
├── BUILD_LOG.md              # Append-only log of decisions made during build
├── BACKLOG.md                # Ideas to add to the system later
├── CLAUDE.md                 # Working rules for Claude Code (subset of this doc)
├── README.md                 # Quick orientation for humans
├── package.json
├── tsconfig.json
├── .gitignore
├── config/
│   ├── routine.json          # Wake time, anchors, practice goals, health
│   ├── prayer-roster.json    # People + situations + dates
│   ├── bible-plan.json       # Tracks: Proverbs, Psalms, Gospels, Isaiah
│   └── tiers.json            # Tier 1/2/3 rules (mostly reference)
├── state/
│   ├── idea-rotation.json    # Tracks last-rotated idea timestamps
│   ├── reading-progress.json # Current chapter for each Bible track
│   ├── brief-history.md      # Append-only log of past briefs
│   └── evening-recap-log.md  # Append-only log of evening recaps
├── scripts/                  # Built incrementally Steps 2–5
├── connectors/               # MCP wrappers, built as needed
├── specs/                    # Step-by-step specs live here
│   ├── step-1-foundation.md      # Done
│   ├── step-2-capture-routing.md # Next
│   ├── step-3-routine-plan-gen.md
│   ├── step-4-morning-brief.md
│   └── step-5-evening-recap.md
└── tests/
    └── manual-test.md        # Validation checklist for current step
```

### Conventions

- **Config files:** JSON, hand-editable, well-commented (use `_comment` fields where JSON allows)
- **State files:** JSON for structured state, markdown for append-only logs
- **TypeScript:** strict mode, no `any` without comment explaining why
- **Scripts:** each one runnable standalone via `npx tsx scripts/<name>.ts` for manual testing
- **No silent decisions:** anything Claude Code decides without explicit instruction goes in BUILD_LOG.md
- **No archive loading:** scripts pull only the slice of data they need (today's calendar, today's reading, etc.)

### Why this stack

- **TypeScript:** Malachi has used Next.js + TypeScript on Motion Students. Comfortable, not learning from scratch.
- **JSON config:** human-editable, version-controlled, no DB required
- **Cloud Routines:** runs without laptop being open (the cardinal requirement of this system)
- **GitHub repo:** Cloud Routines clone the repo each run; clean separation of code/data/state

---

## 4. Phase 1 Build Plan

Phase 1 = ~10–15 focused days of work. Five steps. Then a 2-week soak with the system running daily before any Phase 2 work begins.

### Step 1 — Foundation ✅ DONE

Repo + config schemas + state files + manual test checklist. Scaffolding only, no logic.

### Step 2 — Capture + routing (NEXT)

Goal: A capture script that takes a single input string and routes it to the right system (Calendar / Tasks / Routine / Prayer Roster / Idea Brain). Tier captured at input. Confirmation gate before any write.

See `specs/step-2-capture-routing.md` for full detail when written.

Out of scope for Step 2: morning brief composition, evening recap, scheduled execution.

### Step 3 — Routine + plan generation

Daily-prep script that reads routine config + Bible plan + prayer roster and assembles the inputs the morning brief will need. No brief composition yet — just the data layer.

### Step 4 — Unified morning brief ✅ DONE

Composes and sends the brief via Gmail. Pulls Calendar + Tasks (Google Tasks via custom MCP) + Routine + Practice + Bible reading + Prayer Roster + Idea Brain (Supabase). First wired-up Cloud Routine.

Sub-steps that landed inside Step 4:
- Step 4.5: Idea Brain migrated from Google Doc to Supabase (rich relations, surface tracking)
- Step 4.6: Tasks split out of the Idea Brain into Google Tasks (custom MCP server in `mcp-servers/google-tasks/`)

### Step 4.7 — Morning brief polish — SUPERSEDED

The polish work folded into Step 5 (web app). The email-reply action-handler parser is dropped entirely — real buttons in the web app replace it. See `specs/step-4.7-polish.md` (header notes the supersession).

### Step 5 — Consolidation + Personal Dashboard Web App

Consolidates all state into Supabase, builds a Next.js + Vercel + Supabase web app as the primary daily surface, replaces email with web push notifications, replaces Cloud Routines with Vercel Cron, mirrors tasks to Google Tasks for the iPhone widget. Subsumes the original "evening recap" goals (recap UI is a page in the web app, not a separate email routine). See `specs/step-5-webapp.md`.

**As of 2026-05-05:** Phase A (data consolidation) is complete — all JSON state is now in Supabase. Phase B (the web app build itself) is the next session's work.

### Phase 1 done = MVP

After Step 5, the system runs daily. Soak for 2 weeks. Log what breaks, what feels wrong, what's annoying. Update PROJECT.md. Then decide what Phase 2 actually needs to be — don't assume the v5.1 list is still right.

---

## 5. Backlog

> New ideas for the system itself go here. Not in idea brain (that's for life ideas, not Life OS feature ideas). When ready to build something from this list, write a spec for it and move it to "in progress."

### Phase 2 candidates (originally scoped, validate after MVP soak)

- **Step 6: Personal dashboard web app** — primary direction for Phase 2. Next.js + Supabase + Vercel; push notifications replace email; action handlers become real buttons; unified `/today` view; capture form; idea CRUD; reading tracker; gym + calorie logging; history. Locked decision (2026-05-05): push notifications preferred over email. See `specs/step-6-web-app.md`.
- Auto time-budgeting (system proposes time blocks based on tier and available calendar gaps)
- Midday nudge (light check-in around lunch)
- SMS delivery via Twilio (in addition to email — likely subsumed by web push in Step 6)
- Auto-suggest scheduling (proposes specific calendar slots for items)
- Anchor learning (system observes which Tier 1 anchors actually never move and which do, refines)
- Drift detection (3+ pushes on the same item → "do you actually want this?") — easy to wire after web-app action handlers exist

### Phase 3 candidates

- Goal-to-schedule decomposition: measurable goal + target date → system estimates effort, schedules Tier 3 blocks, recalculates as progress logged
- Use cases: book reading, project hours, fitness goals, notebook digitization
- Bible reading does NOT use this engine (already on a fixed schedule)

### Phase 4 candidates

- Adaptive practice engine: per-goal state, rotating teaching techniques, dynamic content generation
- Verse memorization example: Mon read 5x + reflect, Tue fill-in-blank, Wed type from memory, Thu explain meaning, Fri connect to life, Sat recite cold, Sun review + intro next verse
- Generalizable to: prayer rotations, spiritual prep prompts (Lent/Advent), sermon exegesis, monthly self-reflection bot, language learning, creative skill drills
- AI biz angle: sellable to pastors / educators / coaches who teach rotating practices

### Open ideas (not yet sorted)

- _Add new ideas here as Malachi has them. Format: one-line title, brief description, optional notes._

---

## 6. Open Questions & Decisions Log

### Open questions

- _Add questions here as they come up. Each one gets resolved into "Locked Decisions" or stays open with notes._

### Decisions log

| Date | Decision | Why |
|------|----------|-----|
| 2026-04-27 | Fresh build, no reuse of existing email/calendar agent | User preference; cleaner |
| 2026-04-27 | Cloud Routines, not launchd | Laptop-off requirement |
| 2026-04-27 | Idea Brain migrates from Apple Reminders → Google Doc | Cloud Routines can't read Reminders |
| 2026-04-27 | Capture surface: iOS Shortcut → Google Doc | Free, universal across devices |
| 2026-04-27 | TypeScript on Node 20+ | User's existing comfort (Next.js stack) |
| 2026-04-27 | DRY_RUN flag default true on all writes | Safety; flips after Step 5 validated |
| 2026-04-27 | OpenClaw considered and rejected for Phase 1 | Doesn't solve laptop-off; security concerns; framework overhead |
| 2026-04-27 | Bible: 4 parallel tracks; system prompts 2 days before track ends | User preference; avoids pre-deciding next book |
| 2026-04-27 | Workouts tracked flexibly via evening recap question | User preference; avoids over-rigid scheduling |
| 2026-04-27 | PROJECT.md becomes source of truth; Reminder reduced to backup | Single-source-of-truth principle |
| 2026-04-29 | Idea Brain moves from Google Doc → Supabase (`idea-brain`, `nifkdviqtwokroxvkxzw`) | Need rich relations: categories, cross-links, surface tracking, scheduled state. JSON in a Doc can't model these. Reverses the original "no DB" rule for the Idea Brain only — everything else stays JSON. |
| 2026-04-29 | Capture pipeline rewritten: iOS Shortcut → Supabase POST; `scripts/capture.ts` writes to same table | Single canonical write path, regardless of capture surface. |
| 2026-05-02 | Tasks split from ideas: Google Tasks is canonical for tasks, Supabase for ideas; built custom Google Tasks MCP server in `mcp-servers/google-tasks/` | Tasks need native phone-side check-off UX; ideas need rich relations. Two systems, each best at its job. TODO category in Supabase deprecated and migrated out. |
| 2026-05-05 | Phase 2 direction = personal dashboard web app (Next.js + Supabase + Vercel) replacing email as primary surface | Email is one-way and fragile for action handlers; web app gives buttons, real-time state, dashboards. See `specs/step-6-web-app.md`. |
| 2026-05-05 | Phase 2 morning ping = web push notification, not email | User preference. Email becomes opt-in fallback. |
| 2026-05-05 | Step 4.7 added: morning-brief polish before Step 5 | Closes rough edges (idea summaries, reading-goal page math, gym/calorie capture, action-handler email-reply parser as a stop-gap) without growing scope to web app yet. See `specs/step-4.7-polish.md`. |
| 2026-05-05 | Step 4.7 also summarizes Google Tasks notes (not just idea bodies) | Same treatment as ideas — surface a one-line summary instead of raw notes. |
| 2026-05-05 | AI-suggested scheduling for tasks lands in Step 6 (web app), not Step 4.7 | Needs UI to confirm/decline proposed slots. Email reply can't do that cleanly. Subsumes the original "Auto-suggest scheduling" Phase 2 idea. |
| 2026-05-05 | Pivoted to web app NOW (was Phase 2 / Step 6) — collapsed into Step 5 | Brainstorm + simplicity analysis: the email pipeline is more complex than a web app would be (custom MCP server, multiple OAuth flows, fragile email-reply parsing). The web app reduces moving parts, gives push notifications, makes action handlers real, gives phone editability. Soak rule dropped because the pivot reduces total complexity. |
| 2026-05-05 | All Life OS state consolidated into Supabase | New tables: `tasks`, `prayer_roster`, `bible_tracks`, `routine_settings`, `practice_goals`, `reading_goals`, `workouts`, `calorie_log`, `daily_briefs`. JSON files become deprecated reference. Single canonical source of truth. |
| 2026-05-05 | Tasks pattern: Supabase canonical + Google Tasks mirror | Web app reads/writes Supabase (single source of truth, AI-queryable). A 15-min cron pushes new/changed Supabase tasks to Google Tasks and pulls completions back. iPhone widget retained for glanceable visibility. |
| 2026-05-05 | Vercel Cron replaces Cloud Routines | Free, no quota concerns, runs alongside the web app. Cloud Routines retained until cutover. |

---

## Working Rules for Claude Code

When you (Claude Code) read this file at the start of a session, follow these rules:

### Before writing any code

1. **Read this entire file.** PROJECT.md is the source of truth.
2. **Read CLAUDE.md** for the operating rules of this repo.
3. **Read BUILD_LOG.md** to see decisions already made.
4. **Read the spec for the current step** in `specs/`. If no spec exists for the step you're being asked to build, stop and ask Malachi to provide one. Don't improvise.
5. **Confirm scope** with Malachi before starting. State what you understand the goal to be and what's out of scope. Wait for confirmation.

### While building

6. **Ask, don't assume.** If you hit ambiguity, ask before deciding. Architectural choices are not yours to make silently.
7. **Match conventions.** Read existing files before creating new ones. Match patterns. If you must introduce a new convention, ask first.
8. **Log decisions.** Every non-obvious choice (library, naming, file layout) goes in BUILD_LOG.md with a one-line reason.
9. **Don't scope-creep.** Build only what the current step's spec covers. If you see something useful for a later step, log it in BACKLOG.md and move on.
10. **Each script reads only what it needs.** Never load full archives into context.

### When the step is done

11. **Run the manual test checklist.** Don't declare done until all items pass.
12. **Update BUILD_LOG.md** with what was built.
13. **Update PROJECT.md** if any decisions in §2 changed during the build.
14. **Stop.** Do not start the next step. Wait for Malachi's "go."

### Red flags — stop and ask

- A decision changes something in §2 (Locked Decisions)
- The current step's spec is missing or unclear
- You'd need to install a non-trivial dependency not previously discussed
- You're about to delete or rewrite something existing
- The user is asking you to do something that contradicts the build principle ("ship the smallest reliable loop")

### Idea capture during build

If Malachi says "oh, also add X" mid-step:
- If X is in scope for the current step → add it.
- If X is out of scope → add it to BACKLOG.md, confirm with Malachi, and stay focused on the current step.

---

## Ties to Other Ideas (context, not action items)

- **[PERSONAL] Summer planning system** — the WHAT this assistant runs
- **[PERSONAL] Spiritual prep calendar** — same infra, slots into practice + prayer layers later
- **[PERSONAL] Pray extra during April & October** — prayer roster home
- **[AI BIZ / MINISTRY] Monthly self-reflection check-in bot** — same Phase 4 engine, monthly cadence
- **[AI BIZ] Dogfood case study** for relationship-driven pros (real estate, therapists, event planners, pastors, coaches, educators)

---

*End of PROJECT.md*
