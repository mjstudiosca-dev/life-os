// Vercel Cron: sync Supabase tasks ↔ Google Tasks.
// Runs every 15 min per vercel.json. Idempotent.
//
// Sync rules:
//   1. For tasks where gtasks_id IS NULL → create in Google Tasks; store id
//   2. For tasks where status='completed' AND gtasks_id IS NOT NULL AND
//      (synced_at IS NULL OR synced_at < updated_at) → mark complete in
//      Google Tasks
//   3. Pull all Google Tasks; for any with status='completed' that are
//      still 'active' in Supabase, set Supabase status='completed'

import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import {
  createGoogleTask,
  completeGoogleTask,
  listAllTasks,
} from "@/lib/gtasks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true; // not configured → permissive
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${expected}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const stats = { created: 0, completed_in_gtasks: 0, completed_in_supabase: 0, errors: 0 };

  try {
    // 1. Push new tasks (no gtasks_id yet, status=active).
    const { data: newRows } = await supabase
      .from("tasks")
      .select("id, title, notes, due_date, status, gtasks_id")
      .is("gtasks_id", null)
      .eq("status", "active");

    for (const row of newRows ?? []) {
      try {
        const created = await createGoogleTask({
          title: row.title,
          notes: row.notes,
          due: row.due_date,
        });
        await supabase
          .from("tasks")
          .update({
            gtasks_id: created.id,
            synced_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        stats.created++;
      } catch (err) {
        console.error(`sync-tasks: create failed for task ${row.id}:`, err);
        stats.errors++;
      }
    }

    // 2. Push completions to Google Tasks.
    const { data: completedRows } = await supabase
      .from("tasks")
      .select("id, gtasks_id, synced_at, updated_at, status")
      .eq("status", "completed")
      .not("gtasks_id", "is", null);

    for (const row of completedRows ?? []) {
      // Only push if synced_at is null or older than updated_at.
      const needsPush =
        !row.synced_at || new Date(row.synced_at) < new Date(row.updated_at);
      if (!needsPush) continue;
      try {
        await completeGoogleTask(row.gtasks_id!);
        await supabase
          .from("tasks")
          .update({ synced_at: new Date().toISOString() })
          .eq("id", row.id);
        stats.completed_in_gtasks++;
      } catch (err) {
        console.error(`sync-tasks: complete failed for task ${row.id}:`, err);
        stats.errors++;
      }
    }

    // 3. Pull from Google Tasks; reflect completions back into Supabase.
    const gtasks = await listAllTasks();
    const completedIds = gtasks
      .filter((t) => t.status === "completed")
      .map((t) => t.id);
    if (completedIds.length > 0) {
      const { data: stillActive } = await supabase
        .from("tasks")
        .select("id, gtasks_id")
        .eq("status", "active")
        .in("gtasks_id", completedIds);
      for (const row of stillActive ?? []) {
        await supabase
          .from("tasks")
          .update({
            status: "completed",
            synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        stats.completed_in_supabase++;
      }
    }
  } catch (err) {
    console.error("sync-tasks: fatal", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, stats });
}
