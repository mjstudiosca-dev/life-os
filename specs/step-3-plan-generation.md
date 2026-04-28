# Step 3 Spec — Routine + Plan Generation

**Status:** Resolved — approved, building.
**Depends on:** Step 2 complete ✅
**Out of scope:** Composing or sending any email, reading from Calendar/Tasks/Idea Brain (Step 4), scheduling.

---

## Objective

Build a single script — `scripts/prep.ts` — that reads all local data sources
and assembles the data the morning brief needs into one file:
`state/brief-payload.json`.

Step 4 (morning brief) reads `brief-payload.json` and composes the email from
it. Step 3's job is purely the data layer — no email, no MCP, no external
calls.

Run it manually like this:

```bash
npx tsx scripts/prep.ts
```

It runs silently, writes the file, and prints a one-line confirmation:

```
Brief payload written to state/brief-payload.json (2026-04-28)
```

---

## What it reads

| Source | File |
|--------|------|
| Bible plan config | `config/bible-plan.json` |
| Reading progress (sequential tracks) | `state/reading-progress.json` |
| Prayer roster | `config/prayer-roster.json` |
| Practice goals | `config/routine.json` |
| Idea rotation window | `state/idea-rotation.json` |

No network calls. No MCP. Everything is local.

---

## What it writes

`state/brief-payload.json` — overwritten on every run. Not append-only;
it's a daily snapshot.

```json
{
  "generated_at": "2026-04-28T06:00:00",
  "date": "2026-04-28",
  "day_of_week": "Tuesday",
  "bible_readings": {
    "proverbs":  "Proverbs 28",
    "psalms":    "Psalms 136–140",
    "gospels":   "Mark 5",
    "isaiah":    "Isaiah 10"
  },
  "prayer": {
    "date_anchored": [
      { "name": "Hayden", "situation": "job interview", "date": "2026-04-28" }
    ],
    "ongoing_rotation": [
      { "name": "Mom",    "situation": "Pray for safe travel" },
      { "name": "Dad",    "situation": "Pray for safe travel" },
      { "name": "Trent",  "situation": "Pray for safe travel" }
    ]
  },
  "practice_goals": [
    { "label": "Memorize Philippians 4:13", "scope": "this week" }
  ],
  "placeholders": {
    "note": "Calendar events, Tasks, and Idea Brain are wired in Step 4."
  }
}
```

---

## Bible reading logic — one track at a time

### Proverbs (date_match)
Chapter = day of month. Today is April 28 → **Proverbs 28**. Simple.

### Psalms (monthly_full)
Goal: complete all 150 Psalms in one calendar month. Formula:
- Psalms per day = `ceil(150 / daysInMonth)`
- For April (30 days): exactly 5/day
- Psalm range for day N: `[(N−1)×5 + 1]` through `[min(N×5, 150)]`
- Example: April 28 → Psalms 136–140

For months with 31 days (5 psalms/day = 155, too many), the formula produces
a range that caps at 150 on the last days. The brief shows the full range —
if today is day 30 of 31, it may say "Psalms 146–150" rather than 5 psalms,
and day 31 shows "Psalms 150" (just the last one). This is acceptable for MVP.

### Gospels (sequential)
Read `state/reading-progress.json` → `gospels_current: "Mark 5"`.
That value is today's reading as-is. The script does NOT advance it — see
Open Questions below.

### Isaiah (sequential)
Same as Gospels — read `isaiah_current: "Isaiah 10"`. Do not advance.

---

## Prayer roster logic

Two buckets surfaced each morning:

**Bucket 1 — Date-anchored (always shown on their date):**
Filter all entries where `type === "date_anchored"` and `date === today`.
Show all of them, no limit.

**Bucket 2 — Ongoing rotation:**
Filter all entries where `type === "ongoing"`. Sort by `last_surfaced`:
- `null` entries first (never surfaced → highest priority)
- Then oldest date first

Take the top N entries. What is N? See Open Questions.

The script does NOT update `last_surfaced` during prep — that happens after
the brief is actually sent (Step 4 or Step 5 TBD).

---

## Practice goals

Read `routine.json` → `practice_goals[]`. Pass them through as-is. If empty
(which it currently is), the brief payload has an empty array — Step 4 handles
the "nothing to show" case.

---

## Files created or changed in Step 3

```
life-os/
├── scripts/
│   └── prep.ts                   ← new: the plan generation script
├── state/
│   └── brief-payload.json        ← new: written by prep.ts on each run
├── specs/
│   └── step-3-plan-generation.md ← this file
```

No existing files modified. No new dependencies.

---

## Out of scope for Step 3

- Composing or sending the morning brief email
- Reading from Google Calendar, Tasks, or Idea Brain (all Step 4)
- Advancing Bible reading progress after a read
- Updating `last_surfaced` on prayer roster entries
- Scheduling or automation
- Idea Brain reading or rotation scoring

---

## Resolved decisions

**Q1 — Ongoing prayer count:** 3 per morning. If roster has fewer than 3
ongoing entries, surface all of them. If Malachi wants more on a given day,
he'll ask explicitly.

**Q2 — Reading progress:** Never advances in `prep.ts`. Only advances when
Malachi confirms "I read it" at evening recap (Step 5). Prep always reads the
current stored position.

**Q3 — Track-end warning:** Yes. `prep.ts` includes a `days_until_end` field
for each sequential track. Step 4 shows the prompt when ≤ 2 days remain.
When a track ends, the morning brief prompts Malachi and he tells the assistant
what to read next — the system updates `bible-plan.json` accordingly.

**Timezone:** Brief times (6am, 8pm) follow local clock time wherever Malachi
is — if he travels from Central to Pacific, 6am Pacific is when the brief
fires. `prep.ts` resolves "today" from local system time (correct when running
on his machine; Cloud Routine timezone config is a Step 5 concern). The
`brief-payload.json` includes the resolved timezone name so downstream scripts
know what time context was used.

---

## Manual test checklist

Run these after Step 3 is built:

### Setup
- [ ] `npm run typecheck` passes
- [ ] `state/brief-payload.json` does not exist yet (will be created on first run)

### Basic run
- [ ] `npx tsx scripts/prep.ts` exits with one-line confirmation
- [ ] `state/brief-payload.json` now exists and parses as valid JSON

### Bible readings
- [ ] Proverbs entry = `"Proverbs {day-of-month}"` (e.g. `"Proverbs 28"` on April 28)
- [ ] Psalms entry = correct 5-psalm range for today's date
- [ ] Gospels entry = `"Mark 5"` (matches `reading-progress.json`)
- [ ] Isaiah entry = `"Isaiah 10"` (matches `reading-progress.json`)

### Prayer roster
- [ ] At least 3 ongoing entries appear in `ongoing_rotation`
- [ ] All entries in `ongoing_rotation` have `type: "ongoing"` in the source file
- [ ] If you manually add a `date_anchored` entry with today's date to `prayer-roster.json`, it appears in `date_anchored[]` in the payload

### Practice goals
- [ ] `practice_goals` is an empty array (routine.json is currently empty)
- [ ] If you manually add a goal to `routine.json`, it appears in the payload on the next run

### Re-run idempotency
- [ ] Running `npx tsx scripts/prep.ts` twice produces identical output (no timestamps that change)

---

*Waiting for Malachi's approval and answers to the three open questions before any code is written.*
