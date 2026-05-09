// Hand-written types matching the Supabase schema. Keep in sync with the
// migrations in PROJECT.md / BUILD_LOG.md. Could be generated with
// `supabase gen types typescript` later if it becomes a maintenance burden.

export type Task = {
  id: number;
  title: string;
  notes: string | null;
  status: "active" | "completed" | "archived";
  due_date: string | null;
  gtasks_id: string | null;
  synced_at: string | null;
  source: string | null;
  linked_idea_id: number | null;
  created_at: string;
  updated_at: string;
};

export type PrayerEntry = {
  id: number;
  name: string;
  relation: string | null;
  situation: string;
  type: "ongoing" | "date_anchored" | "archived";
  date: string | null;
  last_surfaced: string | null;
  created_at: string;
};

export type BibleTrack = {
  name: "proverbs" | "psalms" | "gospels" | "isaiah";
  type: "date_match" | "monthly_full" | "sequential";
  rule: string | null;
  current_position: string | null;
  end_position: string | null;
  on_completion: string | null;
  on_completion_prompt_days_before: number;
  last_updated: string | null;
  created_at: string;
};

export type RoutineSettings = {
  id: number;
  settings: {
    wake_time: string;
    evening_recap_time: string;
    health: {
      workouts_per_week: number;
      workout_types: string[];
      daily_calorie_burn_goal: number;
      daily_protein_grams: number;
      tracking: string;
    };
  };
  updated_at: string;
};

export type PracticeGoal = {
  id: number;
  label: string;
  scope: string | null;
  status: "active" | "completed" | "archived";
  added: string | null;
  created_at: string;
  updated_at: string;
};

export type ReadingGoal = {
  id: number;
  title: string;
  total_pages: number;
  current_page: number;
  target_date: string;
  status: "active" | "completed" | "paused";
  created_at: string;
  updated_at: string;
};

export type Workout = {
  id: number;
  date: string;
  type: "lift" | "cardio" | "mobility" | "rest" | "other";
  notes: string | null;
  created_at: string;
};

export type CalorieEntry = {
  id: number;
  date: string;
  calories: number | null;
  protein_g: number | null;
  notes: string | null;
  created_at: string;
};

export type Idea = {
  id: number;
  title: string;
  body: string | null;
  status: string;
  scheduled_for: string | null;
  due_date: string | null;
  priority: string | null;
  last_surfaced_at: string | null;
  surface_count: number;
  is_time_anchored: boolean;
  source: string | null;
  external_ref: string | null;
  created_at: string;
  updated_at: string;
};

export type IdeaWithCategories = Idea & {
  categories: string[];
};

export type CalendarEventLite = {
  id: string;
  title: string;
  startTime: string | null;    // formatted "9:00am" or null for all-day
  endTime: string | null;
  allDay: boolean;
  durationMinutes: number;
  tier: 1 | 2 | 3;
  location: string | null;
};

// What `lib/brief.ts` produces for the Today page.
export type TodayBrief = {
  date: string;          // ISO YYYY-MM-DD
  day_of_week: string;   // 'Wednesday'
  calendar: {
    tier1: CalendarEventLite[];
    tier2: CalendarEventLite[];
    tier3: CalendarEventLite[];
    available: boolean;          // false if Calendar fetch failed
  };
  hours_open: number;            // 16 minus tier1+tier2 duration in hours
  bible: {
    proverbs: string;
    psalms: string;
    gospels: { reading: string; days_until_end: number | null };
    isaiah: { reading: string; days_until_end: number | null };
  };
  prayer: {
    ongoing: { name: string; situation: string }[];
    date_anchored: { name: string; situation: string; date: string }[];
  };
  practice_goals: PracticeGoal[];
  reading_goals: Array<
    ReadingGoal & {
      pages_today: number;
      today_start: number;
      today_end: number;
      days_remaining: number;
    }
  >;
  tasks: Task[];
  ideas_time_anchored: IdeaWithCategories[];
  ideas_rotating: IdeaWithCategories[];
  body: {
    last_workout: Workout | null;
    days_since_workout: number | null;
    workouts_this_week: number;
    weekly_target: number;
    calories_avg_7d: number | null;
    protein_avg_7d: number | null;
    protein_target: number;
  };
};
