# Step 6 Spec — Personal Dashboard Web App (Phase 2)

> **⚠️ SUPERSEDED 2026-05-05.** This is now Step 5, not Step 6 — the
> 2-week soak rule was dropped after the Malachi/Claude brainstorm
> identified that the email pipeline is more complex than a web app
> would be. See `specs/step-5-webapp.md` for the current plan. This
> file kept for reference (the v1 feature list, deployment checklist,
> v2+ candidates remain accurate).

**Status:** SUPERSEDED. See `specs/step-5-webapp.md`.
**Original status:** Vision document. Not started. Don't build until Phase 1 MVP has
soaked for 2 weeks per PROJECT.md's build principle.
**Depends on:** Phase 1 complete (Steps 1–5), 2-week soak with daily use,
identified pain points logged from real usage.
**Out of scope of Phase 1:** everything in this file.

---

## Why this exists

Email is fine for one-way information delivery. It breaks for:

- Two-way interaction (clicking action options on ideas)
- State visibility (browsing all ideas, history, edits)
- Quick logging (gym, calories, pages read)
- Cross-system dashboards (one place to see everything)
- Real-time editing (don't want to use Supabase Studio for daily edits)

The brainstorm with Malachi on 2026-05-05 covered the alternatives and
landed here: a personal Next.js dashboard, push notifications instead of
email, Supabase as the unified source of truth.

**Locked decisions (from the brainstorm):**
- Push notifications are preferred over email
- Web app becomes the primary morning surface
- Email becomes opt-in fallback
- Supabase is the single source of truth (already true for ideas; expand
  to workouts, calorie log, reading goals, prayer roster, brief archive)
- Cloud Routine continues as a backend cron (compute brief, store in
  `daily_briefs` table) — no longer the user-facing surface

---

## Architecture

```
                 ┌──────────────────────┐
                 │  Web app (Next.js)   │
                 │  Vercel deploy       │ ─── push notification at 6am ──► iPhone
                 │  PWA-installable     │
                 └──────────┬───────────┘
                            │ reads/writes
                            ▼
                 ┌──────────────────────┐
                 │  Supabase            │
                 │  (single SoT)        │
                 │  ideas               │
                 │  workouts            │
                 │  calorie_log         │
                 │  reading_goals       │
                 │  prayer_roster       │
                 │  daily_briefs        │
                 │  ...                 │
                 └──────────▲───────────┘
                            │ writes (computed brief, advances state)
                 ┌──────────┴───────────┐
                 │  Cloud Routine       │
                 │  6am: prepare brief  │
                 │  → daily_briefs row  │
                 └──────────────────────┘
```

**Stack:**
- Next.js 14+ (App Router) on Vercel free tier
- Supabase auth (single user — magic-link or passkey)
- Supabase realtime for live updates across tabs/devices
- Web Push API (VAPID keys) for 6am notification
- Tailwind for UI; minimal component library or shadcn
- TypeScript everywhere

---

## v1 features (the minimum viable web app)

### Pages

- **`/today`** — the morning view. One scrollable page with all sections:
  - Today's date + day of week
  - Calendar (Tier 1 / Tier 2 / Tier 3 buckets, read from cached Calendar
    via Cloud Routine fetch)
  - Tasks (live read of Google Tasks via the MCP server's API endpoint)
  - Bible readings (Proverbs / Psalms / Gospels / Isaiah)
  - Reading goals (page math)
  - Practice goals
  - Prayer for today (rotation + date-anchored)
  - Idea brain (3 surfaced ideas with action buttons)
  - Body (gym + calories quick-log inline)
  - Hours open

- **`/capture`** — single form, classifies on submit. Same logic as
  `scripts/capture.ts` ported to a Next.js server action.

- **`/ideas`** — full idea brain CRUD. Filter by category, search by text,
  edit fields, see connections, manage categories.

- **`/reading`** — reading goals management. Add a book, set total pages
  + target date, log pages read, see the daily target update live.

- **`/body`** — workouts + calories. Logging form, last-30-days history,
  weekly averages, streak.

- **`/prayer`** — roster manager. Add people, update situations, mark
  date-anchored entries.

- **`/history`** — every brief archived. Click a date, see exactly what
  was sent that morning.

### Action handlers (replaces Step 4.7's email-reply parser)

Real buttons under each idea on `/today`:
- **Act today** → creates a Google Tasks entry + keeps idea active. The
  app then **AI-suggests a calendar slot** for the new task: looks at
  today's free time around existing Tier 1/2 events, proposes "10:30am –
  11:00am" or "after 3pm". User one-taps to accept or decline.
- **Schedule** → date picker → sets `scheduled_for`, `status = 'scheduled'`.
  Same AI-suggested slot UX, just for the picked date instead of today.
- **Push to next week** → sets `scheduled_for = today + 7`,
  `status = 'scheduled'`
- **Keep quiet** → sets `last_surfaced_at = NOW() + 14 days`

All four mutations are server actions hitting Supabase directly. AI
slot-suggestion uses the user's Calendar (read via Calendar MCP) plus
tier rules: don't propose during Tier 1 blocks, prefer slots ≥30 min,
respect lunch boundaries, etc.

### Auto-scheduling for tasks (broader)

Beyond the action-handler path, the web app proactively offers slots
for any task in the user's Google Tasks list:
- `/today` shows pending Google Tasks with a "schedule" button
- Tap → app proposes 1–3 slots based on today's calendar gaps
- Confirm → creates a calendar block (event with the task title) AND
  links it back to the task via `external_ref` or notes
- Marking the calendar block done auto-completes the linked task

This subsumes the `[Phase 2] Auto-suggest scheduling` BACKLOG entry.

### Notifications

- 6am web push to phone with the brief headline (e.g., "Morning brief ready
  — 0 Tier 1, 5 Tier 2, 3 ideas surfaced. Tap to open.")
- Tap → opens `/today`
- Email fallback: if user hasn't opened the app by 8am, the existing
  morning brief routine sends the email anyway
- Web push setup: VAPID keys, service worker registration, permission
  prompt on first visit, subscription stored in Supabase per device

### Capture surfaces (preserved from Phase 1)

- Web app `/capture` page (new)
- `scripts/capture.ts` terminal script (still works for laptop)
- iOS Shortcut → POST to web app API (replaces direct Supabase POST)
- iOS Shortcut for tasks → still uses Google Tasks app natively

---

## v2+ candidates (build after v1 has soaked)

These are post-v1 ideas from the brainstorm, prioritized roughly:

- **Voice capture via Siri Shortcut** — "Hey Siri, capture: pray for
  Trent's interview Friday" → POST to web app API. Hands-free.
- **Conversational follow-up** — `/today` has a "talk to Claude about
  today" button that opens a chat thread pre-loaded with your day's
  context. Coach-mode.
- **Streak gamification** (selectively) — bible reading streak, gym
  streak, daily capture streak. Not for prayer (gets weird).
- **Per-area tabs** — `/today` tabs into Spirit / Body / Mind / People /
  Work. Same data, just tabbed.
- **Drift detection** — if an idea has been pushed 3+ times, brief / app
  asks "do you actually want this?". Easy once action handlers exist.
- **Weekly review surface** — Sunday evening page showing the week's
  data: what got done, what got missed, what's coming.
- **Photo capture** — iOS share sheet → upload to web app → Claude
  extracts text → routes to right destination (e.g., snap a whiteboard
  sketch, becomes an idea with the photo attached).
- **Email digest** — opt-in weekly digest by email summarizing the week.
- **Exportable** — every system outputs to plain JSON / Markdown on
  demand. Personal data sovereignty.

---

## Migration from Phase 1

Phase 1 produced:
- Supabase `idea-brain` project with `ideas`, `categories`,
  `idea_categories`, `idea_connections`, `surface_log`
- Google Tasks (canonical for tasks via custom MCP)
- Local JSON: `prayer-roster.json`, `routine.json`, `bible-plan.json`,
  `reading-progress.json`
- Cloud Routine that emails the brief

What changes in Phase 2:
- Local JSON files migrate INTO Supabase tables (one-time migration
  scripts, similar shape to `migrate-todos-to-gtasks.ts`)
- Cloud Routine prompt swaps from "compose and email" to "compose and
  insert into `daily_briefs` table"
- Email is opt-in, not default
- Web app reads/writes Supabase directly
- Google Tasks MCP gets hosted (Path 7b in Step 4.6) so the web app
  and the Cloud Routine can both reach it

What stays the same:
- Capture-classification logic (just ported into a Next.js server
  action)
- Bible reading math (`prep.ts` logic)
- Prayer rotation logic
- Tier system, action option semantics, idea schema
- The Cloud Routine itself (just a different output target)

---

## Open questions to resolve before scoping v1

1. **Auth: magic-link via email, or passkey?** Single user, but the app
   shouldn't be public. Passkey is one tap once set up; magic-link is
   familiar.
2. **PWA install vs. native iOS shell (Capacitor)?** PWA is enough for
   web push and home-screen icon. Native shell adds Apple notification
   APIs, App Store potential (only if AI BIZ angle plays out).
3. **Real-time vs. refresh?** Supabase realtime is cheap but adds
   complexity. v1 could just do refresh-on-focus.
4. **Where do the Cloud Routines run from once the app is up?** Same
   `claude.ai/code/routines` infra, or migrate to Supabase Edge Functions
   for tighter coupling? The latter is cleaner but loses Claude's role.
5. **Brief composition**: still done by Claude (Cloud Routine reads
   `morning-brief.md` and writes a row), or moved to a deterministic
   template? Claude composition is more natural-language; deterministic
   is faster and cheaper.

---

## Effort estimate

**v1 build:** 2–3 focused weekends.

- Weekend 1: Next.js scaffold, auth, `/today` page, web push setup,
  realtime read of all Phase 1 data
- Weekend 2: capture form + ideas CRUD + reading tracker + body logging
- Weekend 3: action handlers, history view, polish, deploy

**v2+ each:** ~half-day to ~2 days each, additive.

---

## Why not now

PROJECT.md's build principle:

> Ship the smallest reliable loop. Risk isn't code — risk is abandonment
> from over-engineering. Run MVP for 2 weeks before adding anything to it.

Phase 1 hasn't even fully shipped yet (Step 5 still ahead). Building the
web app before soaking the email MVP would commit us to features we don't
yet know we need, and shape we don't yet know is right. The 2-week soak
will produce a list of "I wish the brief did X" — those are the actual
v1 requirements, not these guesses.

---

## What to do when you come back to this file

1. Confirm Phase 1 has soaked at least 2 weeks of daily use
2. Read this file
3. Read the soak notes (logged in `BUILD_LOG.md` after Step 5)
4. Reconcile: what stayed in scope, what got cut, what got added
5. Pick a weekend, scaffold the Next.js app
6. Build v1 in the order above

---

*Last updated: 2026-05-05*
