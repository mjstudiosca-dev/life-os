# Step 4 Spec — Morning Brief

**Status:** Resolved — approved, building.
**Depends on:** Steps 1–3 complete ✅
**Out of scope:** Evening recap, scheduling automation (Step 5), updating reading
progress or last_surfaced (Step 5).

---

## Objective

Compose and send (or draft, under DRY_RUN) a morning brief email to
mjstudiosca@gmail.com every day at 6am. This is the first step that uses
live data from Google Calendar, Tasks, and the Idea Brain doc.

---

## The brief format

```
Good morning. Today is Tuesday, April 28.

🔒 Locked in (Tier 1)
• 9:00am — Sunday service (weekly)
• [other Tier 1 calendar events]

📌 Plan today (Tier 2)
• Gym
• [other Tier 2 items]

🎯 Available if you want it (Tier 3)
• Read chapter 5 of current book
• [other Tier 3 items]

📖 Practice & devotion
• Proverbs 28
• Psalms 136–140
• Gospels: Mark 5
• Isaiah: Isaiah 10
• Memorize Philippians 4:13 (this week)

🙏 Praying for
• Mom — Pray for safe travel
• Hayden — job interview (today)
• Trent — Pray for safe travel

💡 From your idea brain
• [time-anchored idea — due soon or tied to today]
• [rotating surprise pick]
• [rotating surprise pick]

🌟 You have ~6 hours open today. No pressure.
```

---

## Data sources

| Section | Source | How |
|---------|--------|-----|
| Tier 1/2/3 calendar blocks | Google Calendar | Calendar MCP — today's events |
| Bible readings | `state/brief-payload.json` | Already computed by `prep.ts` |
| Practice goals | `state/brief-payload.json` | Already computed |
| Prayer names | `state/brief-payload.json` | Already computed (3 ongoing + date-anchored) |
| Idea Brain | Google Drive doc | Drive MCP — reads the doc, surfaces 2–3 ideas |
| Hours open | Google Calendar | Total today hours minus Tier 1 blocks |
| Tasks | Google Tasks | Listed under Tier 2 or Tier 3 depending on urgency |

---

## The key architectural question (blocking)

Steps 1–3 are standalone Node scripts run via `npx tsx`. MCP tools only work
inside Claude Code — a standalone script can't call them.

Step 4 has two paths:

**Option A — Cloud Routine prompt (recommended)**

The morning brief IS a Claude Code Cloud Routine. The routine runs as a
scheduled Claude Code session at 6am. Inside that session Claude:

1. Runs `npx tsx scripts/prep.ts` via Bash to generate the payload
2. Reads `state/brief-payload.json`
3. Calls Calendar MCP to get today's events
4. Calls Tasks MCP to get pending tasks
5. Calls Drive MCP to read the Idea Brain doc
6. Composes the brief in the specified format
7. Sends (or drafts) via Gmail MCP

The "code" for Step 4 is mostly the Cloud Routine prompt — the instructions
Claude follows every morning. Some supporting TypeScript may be added (e.g.
a helper to read brief-payload.json and print it cleanly for Claude to parse),
but there's no standalone `morning-brief.ts` that runs outside Claude Code.

**Why this is better:** It uses what's already here. Claude Code handles MCP,
scheduling, and composition in one place. No OAuth credentials to manage, no
new API surface to maintain.

**Option B — TypeScript script + Google APIs directly**

Build `scripts/morning-brief.ts` that calls the Google Calendar, Tasks, and
Drive APIs directly using OAuth credentials stored in `.env`. Uses the
Anthropic API to have Claude compose the brief from the raw data. Sends via
Gmail API.

**Why you might want this:** The script works standalone, outside Claude Code.
More portable. But significantly more setup: OAuth flow for each Google API,
credential storage, token refresh logic. More complexity now for a benefit
that only matters if Cloud Routines stop being the scheduling mechanism.

---

## DRY_RUN behavior for Step 4

- `DRY_RUN=true` (default): creates a Gmail **draft** instead of sending.
  You can open Gmail, read the draft, verify the format looks right, then
  delete the draft.
- `DRY_RUN=false`: sends the email for real.

The first several runs should be in DRY_RUN mode so you can inspect the
output before it starts hitting your inbox every morning.

---

## Open questions — blocking

**Q1 (THE main question) — Cloud Routine prompt vs TypeScript + Google APIs?**
See architectural question above. Recommendation: Option A.

**Q2 — Idea Brain: how many ideas per brief, and how does the selection work?**
PROJECT.md describes two layers:
- Layer 1 (time-anchored): ideas in the doc that mention "this week", "by
  Friday", a date, or a deadline — always surface these first
- Layer 2 (rotating): 2–3 ideas from the rest of the doc, varied across days

For Step 4: surface up to 3 ideas total (1–2 time-anchored if any exist, fill
rest with rotating picks). Does this match your intent?

**Q3 — Tasks: where do they go in the brief?**
Tasks from Google Tasks have no tier assigned (we only capture tier on
Calendar events). Options:
- **Option A:** All tasks show under Tier 2 ("Plan today")
- **Option B:** Show tasks in their own section, separate from Calendar tiers
- **Option C:** Ask Claude to infer tier from the task text ("buy groceries" →
  Tier 3, "email coach about contract" → Tier 2)

Recommendation: Option B — their own "📋 Tasks" section. Simplest and honest
about what they are.

**Q4 — "Hours open" calculation: how precise do you want it?**
The brief says "You have ~X hours open." Options:
- **Simple:** 16 waking hours minus total duration of Tier 1 events
- **Detailed:** 16 hours minus ALL calendar events (Tier 1 + 2)
- **Skip it for now:** Leave that line out until Step 5 when we have more data

Recommendation: Simple — Tier 1 blocks only. Tier 2 is "plan to do" not
"locked in," so it shouldn't shrink the "available" number.

---

## Files created or changed in Step 4

Depends on which architecture is chosen. Under Option A:

```
life-os/
├── specs/
│   └── step-4-morning-brief.md    ← this file
└── (Cloud Routine created via /schedule skill — not a file in the repo)
```

Under Option B:
```
life-os/
├── scripts/
│   └── morning-brief.ts           ← new: compose + send script
├── connectors/
│   ├── calendar.ts                ← updated: stub → real Google Calendar API
│   ├── tasks.ts                   ← updated: stub → real Google Tasks API
│   └── drive.ts                   ← updated: stub → real Google Drive API
├── .env.example                   ← updated: add OAuth credential keys
```

---

## Manual test checklist (after Step 4 is built)

- [ ] Brief runs without errors
- [ ] With `DRY_RUN=true`: a Gmail draft appears in mjstudiosca@gmail.com
- [ ] Draft contains all sections: Tier 1/2/3, Bible, Prayer, Idea Brain
- [ ] Bible readings match what `prep.ts` produced
- [ ] Prayer names match `brief-payload.json`
- [ ] Calendar events are real (pulled from your actual Google Calendar)
- [ ] With `DRY_RUN=false`: email arrives in inbox (run this once to confirm)

## Resolved decisions

**Q1 — Architecture:** Option A — Cloud Routine prompt. No standalone TypeScript
script for the brief itself. The routine runs `prep.ts` via Bash, then uses
MCP tools directly.

**Q2 — Ideas:** Up to 3 per brief. Time-anchored ideas surface first; remaining
slots filled with rotating picks.

**Q3 — Tasks:** Own section — `📋 Tasks` — not mixed into Calendar tiers.

**Q4 — Hours open:** 16 waking hours minus ALL calendar events (Tier 1 + Tier 2
combined). Tier 3 items are optional so they don't count against open time.
