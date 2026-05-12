// Composes the push-notification body using Claude. Personal-assistant
// tone, opens with a Bible verse, then today's most important plan
// items. iOS Web Push notification bodies practical limit is ~240 chars
// before truncation — Claude is prompted to stay tight.

import Anthropic from "@anthropic-ai/sdk";
import type { TodayBrief } from "./types";

type NotificationCopy = {
  title: string;
  body: string;
};

const SYSTEM_PROMPT = `You are Malachi's personal morning-brief assistant. Your job: write a 2–4 sentence morning notification for his phone lock screen.

Hard rules:
- Open with a short, real Bible verse (King James, NIV, or ESV — pick whichever fits) with a 1-sentence reflection on it. Use the verse to encourage him in something concrete he can carry into the day.
- Then summarize today: pick the 1–3 most important calendar items (prefer Tier 1, then Tier 2) and mention if any tasks are due today.
- Tone: warm, direct, like a thoughtful older brother. NOT corporate. NOT a chatbot. NOT preachy.
- 4 sentences max. Under 240 characters TOTAL.
- No emojis. No markdown. No quote marks around the verse — just write it inline.
- Don't restate "today is [day]" — Malachi can read his phone clock.
- If there are no calendar events, mention only the tasks. If neither, lean into the verse and say something brief about a clear day.

Reply with just the body text, nothing else.`;

function buildUserPrompt(brief: TodayBrief): string {
  const lockedIn = brief.calendar.tier1.map((e) => `${e.startTime ?? "all-day"} ${e.title}`);
  const planToday = brief.calendar.tier2.map((e) => `${e.startTime ?? "all-day"} ${e.title}`);
  const tasksDue = brief.tasks.filter((t) => t.due_date === brief.date).map((t) => t.title);
  const tasksAll = brief.tasks.map((t) => t.title);
  const bible = [
    `Proverbs ${brief.bible.proverbs}`,
    brief.bible.psalms,
    `Gospels: ${brief.bible.gospels.reading}`,
    `Isaiah: ${brief.bible.isaiah.reading}`,
  ];
  return JSON.stringify(
    {
      day_of_week: brief.day_of_week,
      hours_open: brief.hours_open,
      bible_readings_today: bible,
      calendar_locked_in: lockedIn,
      calendar_plan_today: planToday,
      tasks_due_today: tasksDue,
      tasks_total: tasksAll.length,
      tasks_titles_preview: tasksAll.slice(0, 5),
    },
    null,
    2,
  );
}

export async function composeNotification(
  brief: TodayBrief,
): Promise<NotificationCopy> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return fallback(brief);
  }
  try {
    const client = new Anthropic({ apiKey });
    const resp = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(brief) }],
    });
    const block = resp.content.find((b) => b.type === "text");
    const text = block && block.type === "text" ? block.text.trim() : "";
    if (!text) return fallback(brief);
    return {
      title: `Good morning, ${brief.day_of_week}`,
      body: text.length > 280 ? text.slice(0, 277) + "…" : text,
    };
  } catch (err) {
    console.error("composeNotification failed:", err);
    return fallback(brief);
  }
}

function fallback(brief: TodayBrief): NotificationCopy {
  const items: string[] = [];
  if (brief.calendar.tier1.length) {
    items.push(
      `${brief.calendar.tier1.length} locked-in event${brief.calendar.tier1.length === 1 ? "" : "s"}`,
    );
  }
  if (brief.calendar.tier2.length) {
    items.push(
      `${brief.calendar.tier2.length} planned`,
    );
  }
  if (brief.tasks.length) {
    items.push(`${brief.tasks.length} task${brief.tasks.length === 1 ? "" : "s"}`);
  }
  return {
    title: `Good morning, ${brief.day_of_week}`,
    body:
      items.length === 0
        ? "Open day. No locked-in events or tasks."
        : `Today: ${items.join(" · ")}.`,
  };
}
