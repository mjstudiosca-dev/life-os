// Vercel Cron: 6 AM daily.
// Composes today's brief, archives it in `daily_briefs`, and sends a web
// push notification to every subscribed device.

import { NextResponse, type NextRequest } from "next/server";
import webpush from "web-push";
import { composeBrief } from "@/lib/brief";
import { composeNotification } from "@/lib/notification";
import { createServiceClient } from "@/lib/supabase/server";
import { listAllTasks } from "@/lib/gtasks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return true;
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${expected}`;
}

function configurePush() {
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

function summary(brief: Awaited<ReturnType<typeof composeBrief>>): string {
  const t1 = brief.tasks.length;
  const i =
    brief.ideas_time_anchored.length + brief.ideas_rotating.length;
  const c =
    brief.calendar.tier1.length +
    brief.calendar.tier2.length +
    brief.calendar.tier3.length;
  return `${c} event${c === 1 ? "" : "s"} · ${t1} task${t1 === 1 ? "" : "s"} · ${i} idea${i === 1 ? "" : "s"}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Step 1 — sync Google Tasks completions back into Supabase, so the
  // brief reflects the user's phone-side check-offs.
  let syncedCompletions = 0;
  try {
    const gtasks = await listAllTasks();
    const completedIds = gtasks.filter((t) => t.status === "completed").map((t) => t.id);
    if (completedIds.length > 0) {
      const { data: stillActive } = await supabase
        .from("tasks")
        .select("id, gtasks_id")
        .eq("status", "active")
        .in("gtasks_id", completedIds);
      if (stillActive?.length) {
        for (const row of stillActive) {
          await supabase
            .from("tasks")
            .update({
              status: "completed",
              synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);
          syncedCompletions++;
        }
      }
    }
  } catch (err) {
    console.error("morning cron: gtasks pull failed:", err);
  }

  // Step 2 — compose brief from current state.
  const brief = await composeBrief();

  // Archive the brief.
  const { data: archived } = await supabase
    .from("daily_briefs")
    .upsert(
      {
        date: brief.date,
        payload: brief,
        delivered_via: "push",
        delivered_at: new Date().toISOString(),
      },
      { onConflict: "date" },
    )
    .select()
    .single();

  // Rotate the prayer roster — mark today's surfaced names as last_surfaced
  // so they cycle out for tomorrow.
  const surfacedPrayerNames = brief.prayer.ongoing.map((p) => p.name);
  if (surfacedPrayerNames.length > 0) {
    await supabase
      .from("prayer_roster")
      .update({ last_surfaced: new Date().toISOString() })
      .in("name", surfacedPrayerNames)
      .eq("type", "ongoing");
  }

  // Compose the AI-written notification body (verse + plan, assistant tone).
  const copy = await composeNotification(brief);

  // Send push to all subscribed devices.
  const pushReady = configurePush();
  let pushed = 0;
  let pushFailed = 0;
  if (pushReady) {
    const { data: subs } = await supabase.from("push_subscriptions").select("*");
    const payload = JSON.stringify({
      title: copy.title,
      body: copy.body,
      url: "/today",
    });
    for (const sub of subs ?? []) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
        );
        pushed++;
      } catch (err: any) {
        pushFailed++;
        // 410 Gone or 404 → subscription is dead, remove it.
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", sub.endpoint);
        } else {
          console.error("push failed:", err?.message ?? err);
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    date: brief.date,
    archived_id: archived?.id,
    synced_completions: syncedCompletions,
    pushed,
    push_failed: pushFailed,
    push_configured: pushReady,
    summary: summary(brief),
    rotated_prayer: surfacedPrayerNames,
    notification_preview: copy.body,
  });
}
