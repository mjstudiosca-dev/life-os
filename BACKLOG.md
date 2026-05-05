# BACKLOG.md

> New ideas for the Life OS itself go here. Not in the Idea Brain (that's for life ideas). When ready to build something, write a spec for it and move it to "in progress."

## Format

```
- **[Tag]** Short title — one-line description. Optional: notes, dependencies, why parked.
```

Tags suggested: `[Phase 2]` `[Phase 3]` `[Phase 4]` `[QoL]` `[Bug]` `[Idea]`

---

## Phase 2 candidates (validate after MVP soak)

- **[Step 6 — primary Phase 2 direction]** Personal dashboard web app (Next.js + Supabase + Vercel). Push notifications replace email as the primary morning surface. Action handlers become real buttons. Unified `/today` view, capture form, idea CRUD, reading tracker, gym + calorie logging, history. Full spec at `specs/step-6-web-app.md`. Don't start until Phase 1 soaks 2 weeks.
- **[Phase 2]** Auto time-budgeting — system proposes time blocks based on tier and calendar gaps
- **[Phase 2]** Midday nudge — light check-in around lunch (likely subsumed by web push in Step 6)
- **[Phase 2]** SMS delivery via Twilio — alongside email (likely subsumed by web push in Step 6)
- **[Phase 2]** Auto-suggest scheduling — proposes specific calendar slots
- **[Phase 2]** Anchor learning — observe which Tier 1 anchors actually never move
- **[Phase 2]** Drift detection — 3+ pushes on the same item triggers "do you actually want this?" (easy after Step 6 action handlers exist)

## Phase 3 candidates

- **[Phase 3]** Goal-to-schedule decomposition — measurable goal + target date → schedules Tier 3 blocks, recalculates with progress
- **[Phase 3]** Use cases: book reading, project hours, fitness goals, notebook digitization

## Phase 4 candidates

- **[Phase 4]** Adaptive practice engine — per-goal state, rotating teaching techniques, dynamic content
- **[Phase 4]** Verse memorization rotation (read → fill-in → type-from-memory → explain → connect → recite → review)
- **[Phase 4]** Generalize engine to: prayer rotations, spiritual prep prompts, sermon exegesis, monthly self-reflection bot, language learning
- **[Phase 4]** Sellable as a product to pastors / educators / coaches

## Quality of life / small ideas

- **[Step 5]** Timezone-aware scheduling — brief fires at 6am local clock wherever Malachi is. Cloud Routine must be configured to fire at the right local time, or read a timezone setting from config and adjust. Confirmed intent: 6am Central stays 6am when traveling to Pacific — not UTC-anchored.
- **[Step 4.6 follow-up]** Host the Google Tasks MCP server (Path 7b) — currently stdio/local only, so the Cloud Routine omits the `📋 Tasks` section in cloud runs. To get tasks into the cloud-run brief, wrap `mcp-servers/google-tasks/` in HTTP/SSE transport and deploy to Cloudflare Workers / Vercel / Railway. Add as custom connector at `claude.ai/customize/connectors`, then attach to the routine.
- **[Idea]** iOS Shortcut for idea capture — tap-to-dictate idea on iPhone, POSTs to Supabase. Tasks already have the Google Tasks app for capture, so this is for ideas only.

## Open / unsorted

- _(empty)_

---

*Last updated: 2026-05-02*
