// Composes today's brief by reading from Supabase. Used by the Today page
// (server component) and the morning cron (which also stores the result
// in `daily_briefs`).

import { createServiceClient } from "./supabase/server";
import { proverbsReading, psalmsReading, chaptersRemaining } from "./bible";
import type {
  BibleTrack,
  CalorieEntry,
  IdeaWithCategories,
  PracticeGoal,
  PrayerEntry,
  ReadingGoal,
  RoutineSettings,
  Task,
  TodayBrief,
  Workout,
} from "./types";

const ONGOING_PRAYER_COUNT = 3;
const IDEA_HARD_CAP = 3;

function todayInLocal(): Date {
  return new Date();
}

function isoDate(d: Date): string {
  return d.toLocaleDateString("en-CA");
}

function dayOfWeekName(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "long" });
}

function daysBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export async function composeBrief(): Promise<TodayBrief> {
  const supabase = createServiceClient();
  const now = todayInLocal();
  const today = isoDate(now);
  const day = now.getDate();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  // Parallel-fetch the static-ish data sources.
  const [
    bibleTracksRes,
    routineRes,
    practiceRes,
    readingRes,
    prayerRes,
    tasksRes,
    workoutsRes,
    caloriesRes,
  ] = await Promise.all([
    supabase.from("bible_tracks").select("*"),
    supabase.from("routine_settings").select("*").eq("id", 1).single(),
    supabase.from("practice_goals").select("*").eq("status", "active"),
    supabase.from("reading_goals").select("*").eq("status", "active"),
    supabase.from("prayer_roster").select("*").neq("type", "archived"),
    supabase.from("tasks").select("*").eq("status", "active").order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("workouts").select("*").gte("date", isoDate(new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000))).order("date", { ascending: false }),
    supabase.from("calorie_log").select("*").gte("date", isoDate(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000))),
  ]);

  const tracks = (bibleTracksRes.data ?? []) as BibleTrack[];
  const settings = (routineRes.data as RoutineSettings | null);
  const practice = (practiceRes.data ?? []) as PracticeGoal[];
  const reading = (readingRes.data ?? []) as ReadingGoal[];
  const prayer = (prayerRes.data ?? []) as PrayerEntry[];
  const tasks = (tasksRes.data ?? []) as Task[];
  const workouts = (workoutsRes.data ?? []) as Workout[];
  const calories = (caloriesRes.data ?? []) as CalorieEntry[];

  // Bible readings.
  const gospels = tracks.find((t) => t.name === "gospels");
  const isaiah = tracks.find((t) => t.name === "isaiah");
  const bible = {
    proverbs: proverbsReading(day),
    psalms: psalmsReading(day, year, month),
    gospels: {
      reading: gospels?.current_position ?? "(no track)",
      days_until_end: gospels
        ? chaptersRemaining(gospels.current_position, gospels.end_position)
        : null,
    },
    isaiah: {
      reading: isaiah?.current_position ?? "(no track)",
      days_until_end: isaiah
        ? chaptersRemaining(isaiah.current_position, isaiah.end_position)
        : null,
    },
  };

  // Prayer rotation.
  const dateAnchored = prayer
    .filter((p) => p.type === "date_anchored" && p.date === today)
    .map((p) => ({ name: p.name, situation: p.situation, date: p.date! }));
  const ongoing = prayer
    .filter((p) => p.type === "ongoing")
    .sort((a, b) => {
      if (a.last_surfaced === null && b.last_surfaced === null) return 0;
      if (a.last_surfaced === null) return -1;
      if (b.last_surfaced === null) return 1;
      return a.last_surfaced < b.last_surfaced ? -1 : 1;
    })
    .slice(0, ONGOING_PRAYER_COUNT)
    .map((p) => ({ name: p.name, situation: p.situation }));

  // Reading-goal page math.
  const reading_goals = reading.map((g) => {
    const days_remaining = Math.max(daysBetween(today, g.target_date), 1);
    const pages_remaining = Math.max(g.total_pages - g.current_page, 0);
    const pages_today = Math.ceil(pages_remaining / days_remaining);
    return {
      ...g,
      pages_today,
      today_start: g.current_page + 1,
      today_end: g.current_page + pages_today,
      days_remaining,
    };
  });

  // Body context.
  const lastWorkout = workouts[0] ?? null;
  const daysSinceWorkout = lastWorkout
    ? daysBetween(lastWorkout.date, today)
    : null;
  const startOfWeek = (() => {
    const d = new Date(now);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday-anchored
    d.setDate(diff);
    return isoDate(d);
  })();
  const workoutsThisWeek = workouts.filter((w) => w.date >= startOfWeek).length;

  const caloriesWithCals = calories.filter((c) => c.calories !== null);
  const caloriesAvg = caloriesWithCals.length
    ? Math.round(
        caloriesWithCals.reduce((s, c) => s + (c.calories ?? 0), 0) /
          caloriesWithCals.length,
      )
    : null;
  const proteinWithVals = calories.filter((c) => c.protein_g !== null);
  const proteinAvg = proteinWithVals.length
    ? Math.round(
        proteinWithVals.reduce((s, c) => s + (c.protein_g ?? 0), 0) /
          proteinWithVals.length,
      )
    : null;

  const body = {
    last_workout: lastWorkout,
    days_since_workout: daysSinceWorkout,
    workouts_this_week: workoutsThisWeek,
    weekly_target: settings?.settings.health.workouts_per_week ?? 5,
    calories_avg_7d: caloriesAvg,
    protein_avg_7d: proteinAvg,
    protein_target: settings?.settings.health.daily_protein_grams ?? 200,
  };

  // Ideas — Query A (time-anchored) + Query B (rotating fill).
  const ideas_time_anchored = await fetchIdeasTimeAnchored(supabase, today);
  const ideas_rotating = await fetchIdeasRotating(
    supabase,
    today,
    Math.max(IDEA_HARD_CAP - ideas_time_anchored.length, 0),
  );

  return {
    date: today,
    day_of_week: dayOfWeekName(now),
    bible,
    prayer: { ongoing, date_anchored: dateAnchored },
    practice_goals: practice,
    reading_goals,
    tasks,
    ideas_time_anchored,
    ideas_rotating,
    body,
  };
}

async function fetchIdeasTimeAnchored(
  supabase: ReturnType<typeof createServiceClient>,
  today: string,
): Promise<IdeaWithCategories[]> {
  // PostgREST doesn't easily express the NOT EXISTS clause we use in the
  // routine SQL, so we do it client-side by fetching candidate ideas plus
  // their categories, then filtering out any with TODO category.
  const { data, error } = await supabase
    .from("ideas")
    .select(
      `id, title, body, status, scheduled_for, due_date, priority,
       last_surfaced_at, surface_count, is_time_anchored, source, external_ref,
       created_at, updated_at,
       idea_categories ( categories ( name ) )`,
    )
    .eq("status", "active")
    .or(
      `is_time_anchored.eq.true,due_date.eq.${today},scheduled_for.eq.${today}`,
    );
  if (error || !data) return [];
  return reshapeIdeas(data).filter((i) => !i.categories.includes("TODO"));
}

async function fetchIdeasRotating(
  supabase: ReturnType<typeof createServiceClient>,
  today: string,
  limit: number,
): Promise<IdeaWithCategories[]> {
  if (limit <= 0) return [];
  const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("ideas")
    .select(
      `id, title, body, status, scheduled_for, due_date, priority,
       last_surfaced_at, surface_count, is_time_anchored, source, external_ref,
       created_at, updated_at,
       idea_categories ( categories ( name ) )`,
    )
    .eq("status", "active")
    .eq("is_time_anchored", false)
    .or(`scheduled_for.is.null,scheduled_for.neq.${today}`)
    .or(`due_date.is.null,due_date.neq.${today}`)
    .or(`last_surfaced_at.is.null,last_surfaced_at.lt.${cutoff}`);
  if (error || !data) return [];
  const reshaped = reshapeIdeas(data).filter(
    (i) => !i.categories.includes("TODO"),
  );
  // Random pick — shuffle, take limit.
  for (let i = reshaped.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [reshaped[i], reshaped[j]] = [reshaped[j]!, reshaped[i]!];
  }
  return reshaped.slice(0, limit);
}

function reshapeIdeas(rows: any[]): IdeaWithCategories[] {
  return rows.map((row) => {
    const cats =
      (row.idea_categories ?? [])
        .map((ic: any) => ic.categories?.name)
        .filter(Boolean) ?? [];
    const { idea_categories, ...rest } = row;
    return { ...(rest as any), categories: cats } as IdeaWithCategories;
  });
}
