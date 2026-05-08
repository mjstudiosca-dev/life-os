# Step 5 Spec — Consolidation + Personal Dashboard Web App

**Status:** Consolidation done (2026-05-05). Web app build pending.
**Replaces:** the old Step 4.7 (polish) and Step 6 (Phase 2 web app) specs — both are now folded into this.
**Depends on:** Step 4.6 (Google Tasks separation) ✅ done

---

## Why this exists

After the 2026-05-05 brainstorm with Malachi, we pivoted from "incremental
polish on the email brief" to "build the simplest assistant that actually
works." The realization: the email pipeline keeps adding complexity (action
handler email parser, multiple OAuth flows, custom MCP server hosting) to
work around the fact that email is one-way. A web app fixes the entire
class of problems and is *simpler*, not more complex.

The locked decisions that came out of the conversation:
1. **Supabase is canonical** for everything (ideas, tasks, prayer, bible,
   routine settings, body data, reading goals, brief archive)
2. **Google Tasks stays as a mirror** for the iPhone widget (one-way push
   from Supabase + periodic pull for completions)
3. **Web push notifications** at 6am replace email as the primary surface
4. **Vercel Cron** replaces Cloud Routines (free, no quota concerns)
5. **Next.js + Vercel + Supabase** is the stack
6. **Single source of truth** — JSON state files in the repo become
   deprecated archives

---

## Done in this session (2026-05-05) — schema and data migration

All Life OS state now lives in Supabase. Tables added:

| Table | Purpose | Rows |
|---|---|---|
| `tasks` | Canonical tasks; mirrored to Google Tasks | 4 (migrated from existing Google Tasks) |
| `prayer_roster` | Was `config/prayer-roster.json` | 9 |
| `bible_tracks` | Consolidated `bible-plan.json` + `reading-progress.json` | 4 |
| `routine_settings` | Was `config/routine.json` (single-row JSONB) | 1 |
| `practice_goals` | Was `practice_goals` array in `routine.json` | 1 (Living Fearless) |
| `reading_goals` | New — page-per-day math | 0 (will populate when web app capture works) |
| `workouts` | New — training log | 0 |
| `calorie_log` | New — nutrition log | 0 |
| `daily_briefs` | New — archive of computed briefs (replaces email archive) | 0 |

Existing tables (unchanged): `ideas`, `categories`, `idea_categories`,
`idea_connections`, `surface_log`.

JSON files in the repo (`config/prayer-roster.json`, `config/bible-plan.json`,
`config/routine.json`, `state/reading-progress.json`,
`state/brief-payload.json`) are now **deprecated reference**. Web app reads
exclusively from Supabase. Old `scripts/capture.ts` and `scripts/prep.ts`
still work against the JSON files but will be retired when the web app
ships.

---

## To build (next session) — the web app

### Stack

- **Next.js 14+** (App Router) on **Vercel** free tier
- **Supabase auth** — magic-link, single user (you)
- **Supabase realtime** — live updates across devices/tabs
- **Web Push API** — daily 6am notification
- **Tailwind** — minimal styling
- TypeScript everywhere

### Repo structure

The web app lives at `web/` in this repo (monorepo style). Existing
`scripts/` and `mcp-servers/` stay; they'll be retired post-cutover.

```
life-os/
├── web/                          # NEW — the Next.js app
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx              # /today (default)
│   │   ├── login/page.tsx
│   │   ├── capture/page.tsx
│   │   ├── ideas/page.tsx
│   │   ├── ideas/[id]/page.tsx
│   │   ├── reading/page.tsx
│   │   ├── body/page.tsx
│   │   ├── prayer/page.tsx
│   │   ├── history/page.tsx
│   │   └── api/
│   │       ├── cron/morning/route.ts     # 6am brief computation
│   │       ├── cron/sync-tasks/route.ts  # Google Tasks ↔ Supabase sync
│   │       ├── push/subscribe/route.ts   # web push registration
│   │       └── tasks/[id]/complete/route.ts
│   ├── lib/
│   │   ├── supabase.ts           # client + server helpers
│   │   ├── classify.ts           # ported from scripts/capture.ts
│   │   ├── brief.ts              # brief composition (ported from prep.ts)
│   │   ├── gtasks.ts             # Google Tasks API client (replaces connectors/tasks.ts)
│   │   └── push.ts               # web push helpers
│   └── components/
│       ├── TodayView.tsx
│       ├── CaptureForm.tsx
│       ├── IdeaCard.tsx          # with Act/Schedule/Push/Quiet buttons
│       ├── BodyLog.tsx
│       └── ...
└── (existing repo unchanged)
```

### v1 features

**`/today`** — single scrollable morning view:
- Calendar (Tier 1/2/3 from Google Calendar)
- Tasks (from Supabase `tasks`, button to mark complete)
- Bible readings (Proverbs, Psalms, Gospels, Isaiah)
- Reading goals (page math)
- Practice goals
- Prayer for today (rotation + date-anchored)
- Idea brain (3 surfaced ideas with REAL action buttons)
- Body (gym last/this-week, calorie averages, inline log forms)
- Hours open

**`/capture`** — single form, classifies on submit. Server action runs the
same logic ported from `scripts/capture.ts` and writes to Supabase.

**`/ideas`** — full idea brain CRUD. Filter by category, search, edit
fields, manage connections. Action buttons available here too.

**`/reading`** — reading goals manager. Add a book with target date, log
pages read, see daily target update live.

**`/body`** — workouts + calories quick-log. Last 30 days history.

**`/prayer`** — roster manager.

**`/history`** — every brief archived in `daily_briefs`. Click a date,
see what was sent.

### Action handlers (real buttons)

- **Act today** → creates a `tasks` row (which syncs to Google Tasks);
  idea stays `status = 'active'`
- **Schedule** → date picker → `scheduled_for = <date>`,
  `status = 'scheduled'`
- **Push to next week** → `scheduled_for = today + 7`,
  `status = 'scheduled'`
- **Keep quiet** → `last_surfaced_at = NOW() + 14 days`

Plus AI-suggested calendar slots when you tap Act/Schedule (Phase 2 of
the web app build, not v1).

### Cron jobs (Vercel)

**`/api/cron/morning`** — runs at 6am via `vercel.json` schedule:
- Read all relevant Supabase data + Google Calendar events
- Compose the brief (using Claude API for summarization)
- Insert into `daily_briefs`
- Send web push notification to subscribed devices

**`/api/cron/sync-tasks`** — runs every 15 min:
- Push new/updated Supabase tasks to Google Tasks
- Pull Google Tasks completions back into Supabase

### Auth

Supabase magic-link. You log in once on each device, session persists.

### Push notifications

- Generate VAPID keys (one-time, stored in env)
- `/api/push/subscribe` saves the subscription per device
- Cron job sends push to all active subscriptions
- Tap notification → opens `/today`

---

## Build order for the web-app session

1. Next.js scaffold + Tailwind + Supabase client + auth (magic link)
2. `/today` page reading from Supabase
3. `/capture` form with classification → Supabase write
4. `/ideas` CRUD with action buttons
5. `/body` and `/reading` quick-logs
6. `/api/cron/morning` — replaces the email morning brief
7. `/api/cron/sync-tasks` — Google Tasks mirror
8. Web push registration + send
9. Vercel deployment + env vars + cron config
10. Cutover: disable old Cloud Routine, archive old scripts

---

## Deployment checklist (for next session)

User-side steps required:
- [ ] Vercel account (free) — sign in with GitHub
- [ ] Connect `mjstudiosca-dev/life-os` repo in Vercel
- [ ] Set root directory to `web/` in Vercel project settings
- [ ] Configure env vars in Vercel:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (server-only)
  - `GOOGLE_OAUTH_CLIENT_ID`
  - `GOOGLE_OAUTH_CLIENT_SECRET`
  - `GOOGLE_TASKS_REFRESH_TOKEN`
  - `GOOGLE_CALENDAR_REFRESH_TOKEN` (need to set up via auth-setup pattern)
  - `ANTHROPIC_API_KEY` (for brief composition)
  - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (web push)
- [ ] Add app URL to Supabase auth allowed redirect URIs
- [ ] First magic-link login from phone, install PWA
- [ ] Allow push notifications

Code-side (next session does this):
- All scaffolding, pages, API routes, cron config

---

## Out of scope for v1 of the web app

- Voice capture via Siri Shortcut (Phase 3)
- Conversational follow-up "talk to Claude about today" (Phase 3)
- Streak gamification (Phase 3)
- Per-area tabs / dashboards (after v1 soak)
- Photo capture (after v1 soak)
- Email digest fallback (optional, after v1)

---

## Migration plan from current state

Once the web app is live and stable:
1. Disable the existing `Life OS Morning Brief` Cloud Routine
2. Archive `scripts/capture.ts`, `scripts/prep.ts`,
   `scripts/migrate-todos-to-gtasks.ts`, `scripts/smoke-test-tasks.ts`
   to `archive/` (don't delete — useful as reference)
3. Remove `mcp-servers/google-tasks/` (replaced by `web/lib/gtasks.ts`)
4. Update `routines/morning-brief.md` to a one-line "this is now web-app
   driven, see web/app/api/cron/morning/route.ts"
5. JSON files in `config/` and `state/` get a `# DEPRECATED` header but
   stay for one rev as fallback reference

---

*Last updated: 2026-05-05*
