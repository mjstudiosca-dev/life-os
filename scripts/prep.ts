// scripts/prep.ts
//
// Reads all local data sources and writes state/brief-payload.json.
// The morning brief (Step 4) reads that file to compose the email.
// No network calls, no MCP, no user prompts — pure data assembly.
//
// Run: npx tsx scripts/prep.ts

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const ROOT = process.cwd();
const PATHS = {
  biblePlan:      resolve(ROOT, "config/bible-plan.json"),
  prayerRoster:   resolve(ROOT, "config/prayer-roster.json"),
  routine:        resolve(ROOT, "config/routine.json"),
  readingProgress: resolve(ROOT, "state/reading-progress.json"),
  briefPayload:   resolve(ROOT, "state/brief-payload.json"),
} as const;

// ---------------------------------------------------------------------------
// Types — source files
// ---------------------------------------------------------------------------

type BibleTrackBase = { name: string };

type DateMatchTrack = BibleTrackBase & {
  type: "date_match";
  rule: string;
  on_completion: string;
};

type MonthlyFullTrack = BibleTrackBase & {
  type: "monthly_full";
  rule: string;
  on_completion: string;
};

type SequentialTrack = BibleTrackBase & {
  type: "sequential";
  current_position: string;
  end_position: string;
  on_completion_prompt_days_before: number;
};

type BibleTrack = DateMatchTrack | MonthlyFullTrack | SequentialTrack;
type BiblePlan = { tracks: BibleTrack[] };

type PrayerEntry = {
  name: string;
  relation: string;
  situation: string;
  type: "ongoing" | "date_anchored";
  date?: string;
  last_surfaced: string | null;
};

type PrayerRoster = { people: PrayerEntry[] };

type PracticeGoalEntry = {
  label: string;
  scope: string | null;
  added: string;
};

type RoutineConfig = {
  wake_time: string;
  evening_recap_time: string;
  practice_goals: PracticeGoalEntry[];
};

type ReadingProgress = {
  gospels_current: string;
  isaiah_current: string;
  last_updated: string | null;
};

// ---------------------------------------------------------------------------
// Types — brief payload (what this script writes)
// ---------------------------------------------------------------------------

type BibleReadings = {
  proverbs: string;
  psalms: string;
  gospels: { reading: string; days_until_end: number | null };
  isaiah:  { reading: string; days_until_end: number | null };
};

type PrayerSurface = {
  date_anchored: { name: string; situation: string; date: string }[];
  ongoing_rotation: { name: string; situation: string }[];
};

type BriefPayload = {
  generated_at: string;
  date: string;
  day_of_week: string;
  timezone: string;
  bible_readings: BibleReadings;
  prayer: PrayerSurface;
  practice_goals: PracticeGoalEntry[];
  placeholders: { note: string };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadJSON<T>(path: string): Promise<T> {
  const text = await readFile(path, "utf8");
  return JSON.parse(text) as T;
}

function isoDate(d: Date): string {
  return d.toLocaleDateString("en-CA"); // "YYYY-MM-DD" in local time
}

function daysInMonth(year: number, month: number): number {
  // month is 1-based
  return new Date(year, month, 0).getDate();
}

function dayOfWeekName(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "long" });
}

function localTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// ---------------------------------------------------------------------------
// Bible reading calculators
// ---------------------------------------------------------------------------

function proverbsReading(dayOfMonth: number): string {
  return `Proverbs ${dayOfMonth}`;
}

function psalmsReading(dayOfMonth: number, year: number, month: number): string {
  // Distribute 150 Psalms across the days of the month.
  // psalmsPerDay = 150 / daysInMonth, rounded so the total always works out.
  // For months with exactly 30 days: 5 per day, clean.
  // For 31-day months: days 1–24 get 5 psalms, days 25–31 get ~4 (150 left
  // after day 24 × 5 = 120 → 30 remaining across 7 days ≈ 4–5 each).
  // We use a simple proportional slice rather than a fixed 5 so any month
  // length works correctly without special cases.
  const total = 150;
  const days = daysInMonth(year, month);
  const start = Math.floor(((dayOfMonth - 1) / days) * total) + 1;
  const end   = Math.floor((dayOfMonth / days) * total);
  return start === end ? `Psalm ${start}` : `Psalms ${start}–${end}`;
}

// Returns how many chapters remain in a sequential track (inclusive of today).
// Parses strings like "Mark 5" and "Mark 16".
function chaptersRemaining(currentPosition: string, endPosition: string): number | null {
  // Expects format "<Book> <chapter_number>" for both positions.
  const parseChapter = (s: string): number | null => {
    const m = s.match(/(\d+)\s*$/);
    return m ? parseInt(m[1], 10) : null;
  };
  const current = parseChapter(currentPosition);
  const end     = parseChapter(endPosition);
  if (current === null || end === null) return null;
  // Inclusive: if current === end, today is the last chapter → 0 days left
  // after today (1 chapter remaining including today).
  return end - current; // chapters left AFTER today's reading
}

// ---------------------------------------------------------------------------
// Prayer roster selection
// ---------------------------------------------------------------------------

const ONGOING_ROTATION_COUNT = 3;

function selectPrayer(roster: PrayerRoster, today: string): PrayerSurface {
  const dateAnchored = roster.people
    .filter((p): p is PrayerEntry & { type: "date_anchored"; date: string } =>
      p.type === "date_anchored" && p.date === today,
    )
    .map((p) => ({ name: p.name, situation: p.situation, date: p.date }));

  // Sort ongoing entries: null last_surfaced first, then oldest date first.
  const ongoing = roster.people
    .filter((p) => p.type === "ongoing")
    .sort((a, b) => {
      if (a.last_surfaced === null && b.last_surfaced === null) return 0;
      if (a.last_surfaced === null) return -1;
      if (b.last_surfaced === null) return 1;
      return a.last_surfaced < b.last_surfaced ? -1 : 1;
    })
    .slice(0, ONGOING_ROTATION_COUNT)
    .map((p) => ({ name: p.name, situation: p.situation }));

  return { date_anchored: dateAnchored, ongoing_rotation: ongoing };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const now   = new Date();
  const today = isoDate(now);

  const [biblePlan, roster, routine, progress] = await Promise.all([
    loadJSON<BiblePlan>(PATHS.biblePlan),
    loadJSON<PrayerRoster>(PATHS.prayerRoster),
    loadJSON<RoutineConfig>(PATHS.routine),
    loadJSON<ReadingProgress>(PATHS.readingProgress),
  ]);

  const dayOfMonth = now.getDate();
  const month      = now.getMonth() + 1; // 1-based
  const year       = now.getFullYear();

  // ---- Bible readings ----
  const gospelsTrack = biblePlan.tracks.find(
    (t): t is SequentialTrack => t.type === "sequential" && t.name === "Gospels",
  );
  const isaiahTrack = biblePlan.tracks.find(
    (t): t is SequentialTrack => t.type === "sequential" && t.name === "Isaiah",
  );

  const gospelsDaysLeft = gospelsTrack
    ? chaptersRemaining(progress.gospels_current, gospelsTrack.end_position)
    : null;
  const isaiahDaysLeft = isaiahTrack
    ? chaptersRemaining(progress.isaiah_current, isaiahTrack.end_position)
    : null;

  const bibleReadings: BibleReadings = {
    proverbs: proverbsReading(dayOfMonth),
    psalms:   psalmsReading(dayOfMonth, year, month),
    gospels:  {
      reading:        progress.gospels_current,
      days_until_end: gospelsDaysLeft,
    },
    isaiah: {
      reading:        progress.isaiah_current,
      days_until_end: isaiahDaysLeft,
    },
  };

  // ---- Prayer ----
  const prayer = selectPrayer(roster, today);

  // ---- Payload ----
  const payload: BriefPayload = {
    generated_at:   now.toISOString(),
    date:           today,
    day_of_week:    dayOfWeekName(now),
    timezone:       localTimezone(),
    bible_readings: bibleReadings,
    prayer,
    practice_goals: routine.practice_goals,
    placeholders: {
      note: "Calendar events, Tasks, and Idea Brain are wired in Step 4.",
    },
  };

  const text = JSON.stringify(payload, null, 2) + "\n";
  await writeFile(PATHS.briefPayload, text, "utf8");

  console.log(`Brief payload written to state/brief-payload.json (${today})`);

  // Warn if any sequential track is close to ending.
  const promptDays = gospelsTrack?.on_completion_prompt_days_before ?? 2;
  if (gospelsDaysLeft !== null && gospelsDaysLeft <= promptDays) {
    console.log(
      `  ⚠ Gospels track ends in ${gospelsDaysLeft} chapter(s) — today is ${progress.gospels_current}. What will you read next?`,
    );
  }
  if (isaiahDaysLeft !== null && isaiahDaysLeft <= (isaiahTrack?.on_completion_prompt_days_before ?? 2)) {
    console.log(
      `  ⚠ Isaiah track ends in ${isaiahDaysLeft} chapter(s) — today is ${progress.isaiah_current}. What will you read next?`,
    );
  }
}

main().catch((err) => {
  console.error("prep.ts failed:", err);
  process.exit(1);
});
