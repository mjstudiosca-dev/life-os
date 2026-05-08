"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { createGoogleTask, completeGoogleTask } from "@/lib/gtasks";
import { revalidatePath } from "next/cache";

type ActionResult = { ok: true } | { ok: false; error: string };

function todayISO(): string {
  return new Date().toLocaleDateString("en-CA");
}

function plusDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
}

// Act today — create a Task linked to this idea; idea stays active.
export async function ideaActToday(ideaId: number): Promise<ActionResult> {
  const supabase = createServiceClient();
  const { data: idea, error } = await supabase
    .from("ideas")
    .select("id, title")
    .eq("id", ideaId)
    .single();
  if (error || !idea) return { ok: false, error: "Idea not found." };

  const { data: inserted, error: insertErr } = await supabase
    .from("tasks")
    .insert({
      title: idea.title,
      notes: null,
      status: "active",
      source: "idea_action",
      linked_idea_id: ideaId,
    })
    .select()
    .single();
  if (insertErr) return { ok: false, error: insertErr.message };

  // Mirror to Google Tasks immediately (best-effort).
  try {
    const created = await createGoogleTask({
      title: idea.title,
      notes: null,
      due: null,
    });
    await supabase
      .from("tasks")
      .update({ gtasks_id: created.id, synced_at: new Date().toISOString() })
      .eq("id", inserted.id);
  } catch {
    // Daily sync cron will retry.
  }

  revalidatePath("/today");
  revalidatePath("/ideas");
  return { ok: true };
}

// Schedule — set scheduled_for and status='scheduled'.
export async function ideaSchedule(
  ideaId: number,
  date: string,
): Promise<ActionResult> {
  if (!date) return { ok: false, error: "Date required." };
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("ideas")
    .update({ scheduled_for: date, status: "scheduled" })
    .eq("id", ideaId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/today");
  revalidatePath("/ideas");
  return { ok: true };
}

// Push to next week — scheduled_for = today + 7.
export async function ideaPushNextWeek(ideaId: number): Promise<ActionResult> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("ideas")
    .update({ scheduled_for: plusDaysISO(7), status: "scheduled" })
    .eq("id", ideaId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/today");
  revalidatePath("/ideas");
  return { ok: true };
}

// Keep quiet — bump last_surfaced_at into the future so it won't surface for ~14 days.
export async function ideaKeepQuiet(ideaId: number): Promise<ActionResult> {
  const supabase = createServiceClient();
  const future = new Date();
  future.setDate(future.getDate() + 14);
  const { error } = await supabase
    .from("ideas")
    .update({ last_surfaced_at: future.toISOString() })
    .eq("id", ideaId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/today");
  revalidatePath("/ideas");
  return { ok: true };
}

// Mark task complete — also called from /today task list.
export async function taskComplete(taskId: number): Promise<ActionResult> {
  const supabase = createServiceClient();
  const { data: task } = await supabase
    .from("tasks")
    .select("id, gtasks_id")
    .eq("id", taskId)
    .single();
  const { error } = await supabase
    .from("tasks")
    .update({
      status: "completed",
      synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);
  if (error) return { ok: false, error: error.message };
  // Mirror completion to Google Tasks (best-effort). Daily sync cron retries.
  if (task?.gtasks_id) {
    try {
      await completeGoogleTask(task.gtasks_id);
    } catch {
      // ignore
    }
  }
  revalidatePath("/today");
  revalidatePath("/body");
  return { ok: true };
}
