// Google Tasks API client. Reads OAuth credentials from process.env.
// Used by /api/cron/sync-tasks.

import { google } from "googleapis";

const DEFAULT_TASKLIST = "@default";

function buildAuth() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET!;
  const refreshToken = process.env.GOOGLE_TASKS_REFRESH_TOKEN!;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Google Tasks OAuth env vars missing.");
  }
  const auth = new google.auth.OAuth2(
    clientId,
    clientSecret,
    "http://localhost:53682/oauth/callback",
  );
  auth.setCredentials({ refresh_token: refreshToken });
  return auth;
}

function client() {
  return google.tasks({ version: "v1", auth: buildAuth() });
}

function toRfc3339(isoDate: string): string {
  return `${isoDate}T00:00:00.000Z`;
}

export async function listAllTasks(): Promise<
  Array<{ id: string; title: string; status: string; due: string | null; notes: string | null }>
> {
  const tasks = client();
  const res = await tasks.tasks.list({
    tasklist: DEFAULT_TASKLIST,
    showCompleted: true,
    showHidden: false,
    maxResults: 100,
  });
  const items = res.data.items ?? [];
  return items.map((t) => ({
    id: t.id ?? "",
    title: t.title ?? "(untitled)",
    status: t.status ?? "needsAction",
    due: t.due ? t.due.slice(0, 10) : null,
    notes: t.notes ?? null,
  }));
}

export async function createGoogleTask(input: {
  title: string;
  notes: string | null;
  due: string | null;
}): Promise<{ id: string }> {
  const tasks = client();
  const res = await tasks.tasks.insert({
    tasklist: DEFAULT_TASKLIST,
    requestBody: {
      title: input.title,
      notes: input.notes ?? undefined,
      due: input.due ? toRfc3339(input.due) : undefined,
    },
  });
  return { id: res.data.id ?? "" };
}

export async function completeGoogleTask(id: string): Promise<void> {
  const tasks = client();
  await tasks.tasks.patch({
    tasklist: DEFAULT_TASKLIST,
    task: id,
    requestBody: { status: "completed" },
  });
}
