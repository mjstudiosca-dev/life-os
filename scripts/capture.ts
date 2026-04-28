// scripts/capture.ts
//
// The single capture surface for the Life OS. Takes a plain-English string,
// classifies it, confirms with the user, then writes (or logs, under DRY_RUN)
// to the right destination. See specs/step-2-capture-routing.md for the
// resolved spec and design decisions.

import { readFile, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface, type Interface } from "node:readline/promises";
import { stdin, stdout, argv } from "node:process";
import * as chrono from "chrono-node";

import { createCalendarEvent } from "../connectors/calendar.js";
import { createTask } from "../connectors/tasks.js";
import { appendToDoc } from "../connectors/drive.js";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

// resolve() against process.cwd() so the script behaves the same regardless
// of where it sits on disk, as long as it's run from the repo root.
const REPO_ROOT = process.cwd();
const PATHS = {
  flags:        resolve(REPO_ROOT, "config/flags.json"),
  envFile:      resolve(REPO_ROOT, ".env"),
  prayerRoster: resolve(REPO_ROOT, "config/prayer-roster.json"),
  routine:      resolve(REPO_ROOT, "config/routine.json"),
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Destination =
  | "prayer"
  | "anchor"
  | "practice_goal"
  | "calendar"
  | "tasks"
  | "idea_brain";

type PrayerEntry = {
  name: string;
  relation: string;
  situation: string;
  type: "ongoing" | "date_anchored";
  date?: string;
  last_surfaced: string | null;
};

type PrayerRoster = { people: PrayerEntry[] };

type AnchorEntry = {
  label: string;
  recurrence_text: string;
  tier: 1 | 2 | 3;
  added: string;
};

type PracticeGoalEntry = {
  label: string;
  scope: string | null;
  added: string;
};

type RoutineConfig = {
  wake_time: string;
  evening_recap_time: string;
  anchors: AnchorEntry[];
  practice_goals: PracticeGoalEntry[];
  health: Record<string, unknown>;
};

type Flags = {
  DRY_RUN: boolean;
  IDEA_BRAIN_DOC_ID: string;
};

// ---------------------------------------------------------------------------
// Readline (single shared interface)
// ---------------------------------------------------------------------------

const rl: Interface = createInterface({ input: stdin, output: stdout });

async function ask(question: string): Promise<string> {
  const answer = await rl.question(question);
  return answer.trim();
}

async function askChoice(question: string, validKeys: string[]): Promise<string> {
  while (true) {
    const answer = (await ask(question)).toLowerCase();
    if (validKeys.includes(answer)) return answer;
    console.log(`  please enter one of: ${validKeys.join(", ")}`);
  }
}

// ---------------------------------------------------------------------------
// Config loading
// ---------------------------------------------------------------------------

function loadFlags(): Flags {
  // Priority order for DRY_RUN:
  //   1. process.env (inline: DRY_RUN=false npx tsx ...)
  //   2. .env file   (local dev config, gitignored)
  //   3. flags.json  (committed safe default)
  let dryRun: boolean | null = null;

  // 1 — process.env
  if (process.env["DRY_RUN"] !== undefined) {
    dryRun = process.env["DRY_RUN"].toLowerCase() === "true";
  }

  // 2 — .env file
  if (dryRun === null && existsSync(PATHS.envFile)) {
    const envText = readFileSync(PATHS.envFile, "utf8");
    for (const rawLine of envText.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq < 0) continue;
      const key = line.slice(0, eq).trim();
      const val = line.slice(eq + 1).trim();
      if (key === "DRY_RUN") {
        dryRun = val.toLowerCase() === "true";
      }
    }
  }

  // 3 — flags.json
  const flagsRaw = JSON.parse(readFileSync(PATHS.flags, "utf8")) as Partial<Flags> & {
    _comment?: string;
  };
  const docId = flagsRaw.IDEA_BRAIN_DOC_ID ?? "";

  return {
    DRY_RUN: dryRun ?? flagsRaw.DRY_RUN ?? true,
    IDEA_BRAIN_DOC_ID: docId,
  };
}

async function loadJSON<T>(path: string): Promise<T> {
  const text = await readFile(path, "utf8");
  return JSON.parse(text) as T;
}

async function writeJSON(path: string, data: unknown): Promise<void> {
  // Two-space indent + trailing newline matches the convention of the
  // hand-edited Step 1 config files.
  const text = JSON.stringify(data, null, 2) + "\n";
  await writeFile(path, text, "utf8");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isoFromDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function timeFromDate(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

type ParsedDate = {
  iso: string;
  matchedText: string;
  hasTime: boolean;
  time: string | null;
};

function parseDate(input: string): ParsedDate | null {
  // chrono.parse returns matches with start/end positions; we take the first.
  const results = chrono.parse(input, new Date(), { forwardDate: true });
  if (results.length === 0) return null;
  const first = results[0];
  const date = first.start.date();
  const hasTime = first.start.isCertain("hour");
  return {
    iso: isoFromDate(date),
    matchedText: first.text,
    hasTime,
    time: hasTime ? timeFromDate(date) : null,
  };
}

function extractTier(input: string): 1 | 2 | 3 {
  // Default to Tier 2 unless the input explicitly mentions Tier 1 or Tier 3.
  // Case-insensitive, accepts "Tier 1" or "tier1".
  const m = input.match(/\btier\s*([123])\b/i);
  if (!m) return 2;
  const n = Number(m[1]);
  return n === 1 || n === 3 ? n : 2;
}

function stripTierPhrase(text: string): string {
  return text.replace(/\btier\s*[123]\b/gi, "").replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Recurrence helpers (for anchors → Calendar recurring events)
// ---------------------------------------------------------------------------

const DAY_NAME_TO_NUMBER: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

const DAY_NAME_TO_BYDAY: Record<string, string> = {
  sunday: "SU", monday: "MO", tuesday: "TU", wednesday: "WE",
  thursday: "TH", friday: "FR", saturday: "SA",
};

type RecurrenceInfo = {
  rrule: string;
  dayNumbers: number[];   // 0=Sun … 6=Sat, for computing next start date
  description: string;    // human-readable, shown in Stage 1
};

function parseRecurrence(input: string): RecurrenceInfo | null {
  const lower = input.toLowerCase();

  if (/\bevery\s+day\b|\bdaily\b/.test(lower)) {
    return { rrule: "RRULE:FREQ=DAILY", dayNumbers: [0,1,2,3,4,5,6], description: "every day" };
  }
  if (/\bevery\s+weekend\b/.test(lower)) {
    return { rrule: "RRULE:FREQ=WEEKLY;BYDAY=SA,SU", dayNumbers: [0, 6], description: "every weekend (Sat + Sun)" };
  }
  if (/\bevery\s+weekday\b/.test(lower)) {
    return { rrule: "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR", dayNumbers: [1,2,3,4,5], description: "every weekday (Mon–Fri)" };
  }
  if (/\bevery\s+week\b/.test(lower)) {
    // "every week" without a day name — fall through to day-name extraction
  }

  // Extract explicit day names from the input ("every Sunday and Saturday", etc.)
  const dayMatches = lower.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/g);
  if (!dayMatches) return null;

  const uniqueDays = [...new Set(dayMatches)].sort(
    (a, b) => DAY_NAME_TO_NUMBER[a] - DAY_NAME_TO_NUMBER[b],
  );
  const bydays = uniqueDays.map((d) => DAY_NAME_TO_BYDAY[d]).join(",");
  const dayNumbers = uniqueDays.map((d) => DAY_NAME_TO_NUMBER[d]);
  const desc = uniqueDays.map((d) => d.charAt(0).toUpperCase() + d.slice(1)).join(" + ");

  return {
    rrule: `RRULE:FREQ=WEEKLY;BYDAY=${bydays}`,
    dayNumbers,
    description: `every ${desc}`,
  };
}

function nextOccurrence(dayNumbers: number[], from: Date): Date {
  // Returns the nearest upcoming date that matches one of the given day-of-week
  // numbers. If multiple days, picks the soonest. Always at least tomorrow —
  // we don't start a recurring event "today".
  const base = new Date(from);
  base.setDate(base.getDate() + 1); // start searching from tomorrow
  for (let i = 0; i < 7; i++) {
    const candidate = new Date(base);
    candidate.setDate(base.getDate() + i);
    if (dayNumbers.includes(candidate.getDay())) return candidate;
  }
  return base; // fallback, should never hit
}

function findRosterMatch(input: string, roster: PrayerRoster): string | null {
  // Word-boundary, case-insensitive name match. Returns the existing exact-case
  // name from the roster so subsequent entries link via identical strings.
  const lower = input.toLowerCase();
  for (const person of roster.people) {
    const pattern = new RegExp(`\\b${escapeRegex(person.name)}\\b`, "i");
    if (pattern.test(lower)) return person.name;
  }
  return null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function detectsPrayerKeyword(input: string): boolean {
  return /\b(pray|prayer|praying)\b/i.test(input);
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

function classify(input: string, roster: PrayerRoster): Destination | null {
  const lower = input.toLowerCase();
  const hasPrayer = detectsPrayerKeyword(input);
  const matchedName = findRosterMatch(input, roster);

  // Rule 1: prayer keyword OR a known roster name combined with situation/date
  if (hasPrayer) return "prayer";
  if (matchedName && parseDate(input)) return "prayer";

  // Rule 2: routine / anchor — recurring time block
  if (
    /\bevery\s+(day|morning|night|week|weekend|weekday|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i.test(lower) ||
    /\banchor\b/i.test(lower)
  ) {
    return "anchor";
  }

  // Rule 3: routine / practice goal
  if (/\b(memorize|practice|verse of the week|reading goal)\b/i.test(lower)) {
    return "practice_goal";
  }

  // Rule 4: calendar — has a specific date/time
  if (parseDate(input)) return "calendar";

  // Rule 5: tasks — action verb without a specific time
  if (/^\s*(buy|email|order|call|schedule|book|pick up|grab|get|send|text|message)\b/i.test(input)) {
    return "tasks";
  }

  // Rule 6: idea brain — open-ended thought
  if (/\b(what if|maybe|i wonder|could|should we|idea)\b/i.test(lower)) return "idea_brain";

  // No confident classification.
  return null;
}

// ---------------------------------------------------------------------------
// Stage 1 — destination confirmation + manual override
// ---------------------------------------------------------------------------

const DEST_LABELS: Record<Destination, string> = {
  prayer:        "Prayer roster",
  anchor:        "Routine — anchor",
  practice_goal: "Routine — practice goal",
  calendar:      "Calendar",
  tasks:         "Tasks",
  idea_brain:    "Idea Brain",
};

async function pickManually(): Promise<Destination | null> {
  console.log("");
  console.log("Pick a destination:");
  const order: Destination[] = [
    "prayer", "anchor", "practice_goal", "calendar", "tasks", "idea_brain",
  ];
  order.forEach((d, i) => console.log(`  [${i + 1}] ${DEST_LABELS[d]}`));
  console.log("  [q] quit");

  const choice = await askChoice("Choice: ", ["1", "2", "3", "4", "5", "6", "q"]);
  if (choice === "q") return null;
  return order[Number(choice) - 1] ?? null;
}

async function confirmDestination(
  input: string,
  guess: Destination | null,
): Promise<Destination | null> {
  console.log("");
  console.log(`Input: "${input}"`);
  console.log("");
  if (guess === null) {
    console.log("I'm not confident where this should go.");
    return await pickManually();
  }
  console.log(`Best guess: ${DEST_LABELS[guess]}`);
  const ans = await askChoice(
    "Is this right? [y] yes  [n] pick manually  [q] quit: ",
    ["y", "n", "q"],
  );
  if (ans === "q") return null;
  if (ans === "n") return await pickManually();
  return guess;
}

// ---------------------------------------------------------------------------
// Stage 2/3/4 — DRY_RUN gate + write
// ---------------------------------------------------------------------------

async function gateAndWrite(
  flags: Flags,
  description: string,
  doWrite: () => Promise<void>,
): Promise<void> {
  if (flags.DRY_RUN) {
    console.log("");
    console.log(`DRY_RUN is on — nothing was written. (${description})`);
    return;
  }
  await doWrite();
  console.log("");
  console.log(`Written: ${description}`);
}

// ---------------------------------------------------------------------------
// Handler — Prayer roster
// ---------------------------------------------------------------------------

async function handlePrayer(input: string, flags: Flags): Promise<void> {
  const roster = await loadJSON<PrayerRoster>(PATHS.prayerRoster);
  const matchedName = findRosterMatch(input, roster);
  const parsedDate = parseDate(input);

  if (matchedName) {
    await handlePrayerExisting(input, matchedName, parsedDate, roster, flags);
  } else {
    await handlePrayerNewPerson(input, parsedDate, roster, flags);
  }
}

function extractSituationFor(
  input: string,
  name: string | null,
  parsedDate: ParsedDate | null,
): string {
  // Strip prayer prefixes, the person's name (and possessive), the date phrase,
  // and connecting filler. Whatever is left is the situation phrase. This is
  // deliberately a heuristic — Stage 2 lets the user correct it.
  let s = input;
  s = s.replace(/^\s*(please\s+)?(pray(ing)?\s+for|pray(ing)?\s+about|pray)\s*/i, "");
  if (name) {
    const nameRx = new RegExp(`\\b${escapeRegex(name)}('s|s)?\\b`, "ig");
    s = s.replace(nameRx, "");
  }
  if (parsedDate) {
    s = s.replace(parsedDate.matchedText, "");
  }
  s = s
    .replace(/\b(has|have|is|are|will be|was|were)\b/gi, "")
    .replace(/\b(an?|the|on|at|for|about|this|next)\b/gi, "")
    .replace(/[.,;:!?]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return s;
}

async function handlePrayerExisting(
  input: string,
  name: string,
  parsedDate: ParsedDate | null,
  roster: PrayerRoster,
  flags: Flags,
): Promise<void> {
  const guessedSituation = extractSituationFor(input, name, parsedDate);
  const today = todayISO();

  console.log("");
  console.log(`Person   : ${name} (already in roster)`);
  console.log(`Situation: ${guessedSituation || "(none extracted)"}`);
  console.log(`Date     : ${parsedDate ? `${parsedDate.matchedText} → ${parsedDate.iso}` : "(none)"}`);

  // Case 2: no situation, no date → no useful new entry. Prompt the user.
  if (!guessedSituation && !parsedDate) {
    console.log("");
    console.log(`${name} is already in your roster. Add a specific situation? [y/n]`);
    const ans = await askChoice("> ", ["y", "n"]);
    if (ans === "n") return;
    const text = await ask("Situation? ");
    if (!text) {
      console.log("No situation given — nothing to write.");
      return;
    }
    await writePrayerEntry(name, lookupRelation(name, roster) ?? "", text, null, today, flags);
    return;
  }

  // Use the existing relation from the roster so the new entry is consistent.
  const relation = lookupRelation(name, roster) ?? "";

  // Confirm / edit the situation phrase.
  const situation = await confirmField("Situation", guessedSituation);
  if (!situation) {
    console.log("No situation given — nothing to write.");
    return;
  }

  await writePrayerEntry(
    name,
    relation,
    situation,
    parsedDate ? parsedDate.iso : null,
    today,
    flags,
  );
}

async function handlePrayerNewPerson(
  input: string,
  parsedDate: ParsedDate | null,
  roster: PrayerRoster,
  flags: Flags,
): Promise<void> {
  const guessedName = extractProperNoun(input);
  console.log("");
  if (guessedName) {
    console.log(`Person guess: ${guessedName} (NOT in roster)`);
  } else {
    console.log("No name detected.");
  }
  const proceed = await askChoice("Add a new person to the roster? [y/n] ", ["y", "n"]);
  if (proceed === "n") return;

  const name = await confirmField("Name", guessedName ?? "");
  if (!name) {
    console.log("No name given — nothing to write.");
    return;
  }
  const relation = await ask("Relation? (e.g., friend, family, mentor, brother): ");
  const guessedSituation = extractSituationFor(input, name, parsedDate);
  const situation = await confirmField("Situation", guessedSituation);
  if (!situation) {
    console.log("No situation given — nothing to write.");
    return;
  }

  await writePrayerEntry(
    name,
    relation,
    situation,
    parsedDate ? parsedDate.iso : null,
    todayISO(),
    flags,
  );
}

function lookupRelation(name: string, roster: PrayerRoster): string | null {
  const found = roster.people.find((p) => p.name === name);
  return found ? found.relation : null;
}

async function writePrayerEntry(
  name: string,
  relation: string,
  situation: string,
  isoDate: string | null,
  _today: string,
  flags: Flags,
): Promise<void> {
  const entry: PrayerEntry = isoDate
    ? {
        name,
        relation,
        situation,
        type: "date_anchored",
        date: isoDate,
        last_surfaced: null,
      }
    : {
        name,
        relation,
        situation,
        type: "ongoing",
        last_surfaced: null,
      };

  console.log("");
  console.log("New entry to append to prayer-roster.json:");
  console.log(JSON.stringify(entry, null, 2));

  const ok = await askChoice("Confirm write? [y/n] ", ["y", "n"]);
  if (ok === "n") {
    console.log("Cancelled.");
    return;
  }

  await gateAndWrite(flags, "prayer-roster.json — new entry", async () => {
    const current = await loadJSON<PrayerRoster>(PATHS.prayerRoster);
    current.people.push(entry);
    await writeJSON(PATHS.prayerRoster, current);
  });
}

function extractProperNoun(input: string): string | null {
  // Pull the first capitalised token sequence that isn't a known stop word.
  // Heuristic — Stage 2 confirms.
  const stop = new Set([
    "Pray", "Praying", "Please", "Tier", "Tomorrow", "Today", "Tonight",
    "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
    "Next", "This",
  ]);
  const tokens = input.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) ?? [];
  for (const t of tokens) {
    const head = t.split(/\s+/)[0];
    if (!stop.has(head)) return t;
  }
  return null;
}

async function confirmField(label: string, suggestion: string): Promise<string> {
  if (suggestion) {
    const a = await ask(`${label}: ${suggestion}  [enter to keep, or type new]: `);
    return a || suggestion;
  }
  return await ask(`${label}: `);
}

// ---------------------------------------------------------------------------
// Handler — Anchor (recurring routine block)
// ---------------------------------------------------------------------------

async function handleAnchor(input: string, flags: Flags): Promise<void> {
  const tier = extractTier(input);
  const recurrence = parseRecurrence(input);

  if (!recurrence) {
    console.log("");
    console.log("I couldn't detect a recurrence pattern (e.g. 'every Sunday', 'every weekday').");
    console.log("Try again with a day name — e.g. 'Sunday service every Sunday Tier 1'");
    return;
  }

  // Build the label by stripping the recurrence and tier phrases from the input.
  const rruleDay = recurrence.description;
  const labelGuess = stripTierPhrase(
    input
      .replace(/\bevery\s+(day|weekend|weekday|week|sunday|monday|tuesday|wednesday|thursday|friday|saturday)(\s+and\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday))?\b/gi, "")
      .trim(),
  ) || input;

  // Start date = next occurrence of the specified day(s), never today.
  const startDate = nextOccurrence(recurrence.dayNumbers, new Date());
  const startISO = isoFromDate(startDate);

  console.log("");
  console.log(`Recurrence: ${rruleDay}`);
  console.log(`Start date: ${startISO} (first upcoming occurrence)`);
  console.log(`RRULE     : ${recurrence.rrule}`);
  console.log(`Tier      : ${tier}`);

  const label = await confirmField("Label", labelGuess);
  if (!label) {
    console.log("No label given — nothing to write.");
    return;
  }

  const payload = {
    title: label,
    date: startISO,
    time: null,
    durationMinutes: 60,
    timezone: "America/Los_Angeles",
    tier,
    recurrence: recurrence.rrule,
  } as const;

  console.log("");
  console.log("Calendar recurring event payload:");
  console.log(JSON.stringify(payload, null, 2));

  const ok = await askChoice("Confirm write? [y/n] ", ["y", "n"]);
  if (ok === "n") return;

  await gateAndWrite(flags, "Calendar recurring event (stub)", async () => {
    await createCalendarEvent(payload);
  });
}

// ---------------------------------------------------------------------------
// Handler — Practice goal
// ---------------------------------------------------------------------------

async function handlePracticeGoal(input: string, flags: Flags): Promise<void> {
  const scopeMatch = input.match(/\b(this week|this month|today|this year)\b/i);
  const scope = scopeMatch ? scopeMatch[0] : null;
  const labelGuess = scope ? input.replace(scope, "").trim() : input.trim();

  console.log("");
  console.log(`Scope: ${scope ?? "(none)"}`);

  const label = await confirmField("Label", labelGuess);
  if (!label) {
    console.log("No label given — nothing to write.");
    return;
  }

  const entry: PracticeGoalEntry = {
    label,
    scope,
    added: todayISO(),
  };

  console.log("");
  console.log("New entry to append to routine.json → practice_goals:");
  console.log(JSON.stringify(entry, null, 2));

  const ok = await askChoice("Confirm write? [y/n] ", ["y", "n"]);
  if (ok === "n") return;

  await gateAndWrite(flags, "routine.json — practice_goals", async () => {
    const r = await loadJSON<RoutineConfig>(PATHS.routine);
    r.practice_goals.push(entry);
    await writeJSON(PATHS.routine, r);
  });
}

// ---------------------------------------------------------------------------
// Handler — Calendar (stub)
// ---------------------------------------------------------------------------

async function handleCalendar(input: string, flags: Flags): Promise<void> {
  const parsed = parseDate(input);
  if (!parsed) {
    console.log("");
    console.log("No date found in the input. Calendar events need a date.");
    return;
  }
  const tier = extractTier(input);
  const titleGuess = stripTierPhrase(input.replace(parsed.matchedText, "").trim()) || input;

  console.log("");
  console.log(`Date : ${parsed.matchedText} → ${parsed.iso}`);
  console.log(`Time : ${parsed.time ?? "(no specific time, will default to 09:00)"}`);
  console.log(`Tier : ${tier}`);

  const title = await confirmField("Title", titleGuess);
  if (!title) {
    console.log("No title given — nothing to write.");
    return;
  }

  const payload = {
    title,
    date: parsed.iso,
    time: parsed.time,
    durationMinutes: 60,
    timezone: "America/Los_Angeles",
    tier,
    recurrence: null,
  } as const;

  console.log("");
  console.log("Calendar event payload:");
  console.log(JSON.stringify(payload, null, 2));

  const ok = await askChoice("Confirm write? [y/n] ", ["y", "n"]);
  if (ok === "n") return;

  await gateAndWrite(flags, "Calendar event (stub)", async () => {
    await createCalendarEvent(payload);
  });
}

// ---------------------------------------------------------------------------
// Handler — Tasks (stub)
// ---------------------------------------------------------------------------

async function handleTasks(input: string, flags: Flags): Promise<void> {
  const parsed = parseDate(input);
  const titleGuess = parsed ? input.replace(parsed.matchedText, "").trim() : input.trim();

  console.log("");
  console.log(`Due date: ${parsed ? `${parsed.matchedText} → ${parsed.iso}` : "(none)"}`);

  const title = await confirmField("Title", titleGuess);
  if (!title) {
    console.log("No title given — nothing to write.");
    return;
  }

  const payload = {
    title,
    notes: null,
    dueDate: parsed ? parsed.iso : null,
  } as const;

  console.log("");
  console.log("Task payload:");
  console.log(JSON.stringify(payload, null, 2));

  const ok = await askChoice("Confirm write? [y/n] ", ["y", "n"]);
  if (ok === "n") return;

  await gateAndWrite(flags, "Task (stub)", async () => {
    await createTask(payload);
  });
}

// ---------------------------------------------------------------------------
// Handler — Idea Brain (stub)
// ---------------------------------------------------------------------------

async function handleIdeaBrain(input: string, flags: Flags): Promise<void> {
  if (!flags.IDEA_BRAIN_DOC_ID) {
    console.log("");
    console.log("IDEA_BRAIN_DOC_ID is not set in config/flags.json — cannot append.");
    return;
  }

  const line = `- ${todayISO()} — ${input.trim()}`;
  console.log("");
  console.log("Idea Brain append payload:");
  console.log(JSON.stringify({ docId: flags.IDEA_BRAIN_DOC_ID, line }, null, 2));

  const ok = await askChoice("Confirm write? [y/n] ", ["y", "n"]);
  if (ok === "n") return;

  await gateAndWrite(flags, "Idea Brain doc append (stub)", async () => {
    await appendToDoc({ docId: flags.IDEA_BRAIN_DOC_ID, line });
  });
}

// ---------------------------------------------------------------------------
// main()
// ---------------------------------------------------------------------------

function printUsage(): void {
  console.log("Usage: npx tsx scripts/capture.ts \"your input string\"");
  console.log("");
  console.log("Examples:");
  console.log('  npx tsx scripts/capture.ts "Hayden has a job interview Tuesday"');
  console.log('  npx tsx scripts/capture.ts "Gym tomorrow at 9am"');
  console.log('  npx tsx scripts/capture.ts "Buy groceries"');
}

async function main(): Promise<void> {
  const input = (argv[2] ?? "").trim();
  if (!input) {
    printUsage();
    rl.close();
    return;
  }

  const flags = loadFlags();
  if (flags.DRY_RUN) {
    console.log("(DRY_RUN is on — no real writes will happen this run.)");
  }

  const roster = await loadJSON<PrayerRoster>(PATHS.prayerRoster);
  const guess = classify(input, roster);
  const dest = await confirmDestination(input, guess);
  if (!dest) {
    console.log("Cancelled.");
    rl.close();
    return;
  }

  switch (dest) {
    case "prayer":        await handlePrayer(input, flags); break;
    case "anchor":        await handleAnchor(input, flags); break;
    case "practice_goal": await handlePracticeGoal(input, flags); break;
    case "calendar":      await handleCalendar(input, flags); break;
    case "tasks":         await handleTasks(input, flags); break;
    case "idea_brain":    await handleIdeaBrain(input, flags); break;
  }

  rl.close();
}

main().catch((err) => {
  // Piped stdin can close before later prompts run; treat that as a clean exit
  // since interactive use never hits this path.
  if (err && (err as { code?: string }).code === "ERR_USE_AFTER_CLOSE") {
    process.exit(0);
  }
  console.error("capture.ts failed:", err);
  rl.close();
  process.exit(1);
});
