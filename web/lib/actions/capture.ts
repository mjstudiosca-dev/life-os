"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { createGoogleTask } from "@/lib/gtasks";
import { revalidatePath } from "next/cache";

type CaptureType =
  | "idea"
  | "task"
  | "prayer"
  | "workout"
  | "calorie"
  | "reading_goal";

export type CaptureResult = { ok: true; message: string } | { ok: false; error: string };

const TIME_ANCHOR_RE = /\b(this week|by [a-z]+|soon|upcoming|today|tomorrow|tonight)\b/i;

function splitTitleAndBody(input: string): { title: string; body: string | null } {
  const trimmed = input.trim();
  const match = trimmed.match(/^(.+?[.!?])\s+(.+)$/s);
  if (match) return { title: match[1]!.trim(), body: match[2]!.trim() };
  if (trimmed.length <= 80) return { title: trimmed, body: null };
  const cut = trimmed.lastIndexOf(" ", 80);
  const splitAt = cut > 40 ? cut : 80;
  return {
    title: trimmed.slice(0, splitAt).trim(),
    body: trimmed.slice(splitAt).trim(),
  };
}

export async function capture(
  type: CaptureType,
  input: string,
  extras: Record<string, string | number | null> = {},
): Promise<CaptureResult> {
  const supabase = createServiceClient();
  const text = input.trim();
  if (!text) return { ok: false, error: "Empty input." };

  try {
    if (type === "idea") {
      const { title, body } = splitTitleAndBody(text);
      const { error } = await supabase.from("ideas").insert({
        title,
        body,
        status: "active",
        is_time_anchored: TIME_ANCHOR_RE.test(text),
        source: "web_capture",
      });
      if (error) throw error;
      revalidatePath("/today");
      revalidatePath("/ideas");
      return { ok: true, message: "Idea added." };
    }

    if (type === "task") {
      const due = (extras.due_date as string) || null;
      // Create in Supabase first.
      const { data: inserted, error } = await supabase
        .from("tasks")
        .insert({
          title: text,
          notes: null,
          status: "active",
          due_date: due,
          source: "web_capture",
        })
        .select()
        .single();
      if (error) throw error;
      // Immediately mirror to Google Tasks (so it shows in the iPhone widget right away).
      // If this fails, the daily sync cron picks it up.
      let mirrorMsg = "";
      try {
        const created = await createGoogleTask({
          title: text,
          notes: null,
          due,
        });
        await supabase
          .from("tasks")
          .update({
            gtasks_id: created.id,
            synced_at: new Date().toISOString(),
          })
          .eq("id", inserted.id);
        mirrorMsg = " Synced to Google Tasks.";
      } catch (err) {
        mirrorMsg = " (Google Tasks sync deferred — daily cron will retry.)";
      }
      revalidatePath("/today");
      return { ok: true, message: `Task added.${mirrorMsg}` };
    }

    if (type === "prayer") {
      const name = (extras.name as string) || "";
      const relation = (extras.relation as string) || null;
      const date = (extras.date as string) || null;
      if (!name) return { ok: false, error: "Name required for prayer entries." };
      const { error } = await supabase.from("prayer_roster").insert({
        name,
        relation,
        situation: text,
        type: date ? "date_anchored" : "ongoing",
        date,
      });
      if (error) throw error;
      revalidatePath("/today");
      revalidatePath("/prayer");
      return { ok: true, message: `Prayer entry for ${name} added.` };
    }

    if (type === "workout") {
      const workoutType = (extras.type as string) || "other";
      const date = (extras.date as string) || new Date().toLocaleDateString("en-CA");
      const { error } = await supabase.from("workouts").insert({
        date,
        type: workoutType,
        notes: text || null,
      });
      if (error) throw error;
      revalidatePath("/today");
      revalidatePath("/body");
      return { ok: true, message: `${workoutType} session logged.` };
    }

    if (type === "calorie") {
      const calories = extras.calories ? Number(extras.calories) : null;
      const protein = extras.protein_g ? Number(extras.protein_g) : null;
      const date = (extras.date as string) || new Date().toLocaleDateString("en-CA");
      const { error } = await supabase.from("calorie_log").insert({
        date,
        calories,
        protein_g: protein,
        notes: text || null,
      });
      if (error) throw error;
      revalidatePath("/today");
      revalidatePath("/body");
      return { ok: true, message: "Calorie entry logged." };
    }

    if (type === "reading_goal") {
      const totalPages = Number(extras.total_pages);
      const targetDate = (extras.target_date as string) || "";
      if (!totalPages || !targetDate) {
        return { ok: false, error: "Reading goal requires total_pages and target_date." };
      }
      const { error } = await supabase.from("reading_goals").insert({
        title: text,
        total_pages: totalPages,
        current_page: 0,
        target_date: targetDate,
        status: "active",
      });
      if (error) throw error;
      revalidatePath("/today");
      revalidatePath("/reading");
      return { ok: true, message: `Reading goal "${text}" added.` };
    }

    return { ok: false, error: `Unknown capture type: ${type}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
