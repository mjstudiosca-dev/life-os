// Local Google Tasks client. Used by capture.ts (interactive task creation)
// and scripts/migrate-todos-to-gtasks.ts (one-time migration).
//
// This is a thin wrapper around the official googleapis client. The MCP
// server (mcp-servers/google-tasks/) is the equivalent for remote callers
// (the Cloud Routine). Both rely on the same three env vars:
//
//   GOOGLE_OAUTH_CLIENT_ID
//   GOOGLE_OAUTH_CLIENT_SECRET
//   GOOGLE_TASKS_REFRESH_TOKEN
//
// The caller is responsible for loading .env into process.env before
// invoking these functions.

import { google } from "googleapis";

export type TaskInput = {
  title: string;
  notes: string | null;
  dueDate: string | null;       // ISO date "YYYY-MM-DD" or null
};

export type CreatedTask = {
  id: string;
  title: string;
};

const DEFAULT_TASKLIST = "@default";
const REDIRECT_URI = "http://localhost:53682/oauth/callback";

function buildAuth() {
  const clientId = process.env["GOOGLE_OAUTH_CLIENT_ID"];
  const clientSecret = process.env["GOOGLE_OAUTH_CLIENT_SECRET"];
  const refreshToken = process.env["GOOGLE_TASKS_REFRESH_TOKEN"];
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Google Tasks connector needs GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, " +
        "and GOOGLE_TASKS_REFRESH_TOKEN in .env. Run mcp-servers/google-tasks/scripts/auth-setup.ts " +
        "to obtain a refresh token.",
    );
  }
  const auth = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
  auth.setCredentials({ refresh_token: refreshToken });
  return auth;
}

function tasksClient() {
  return google.tasks({ version: "v1", auth: buildAuth() });
}

function toRfc3339Date(isoDate: string): string {
  return `${isoDate}T00:00:00.000Z`;
}

export async function createTask(input: TaskInput): Promise<CreatedTask> {
  const tasks = tasksClient();
  const res = await tasks.tasks.insert({
    tasklist: DEFAULT_TASKLIST,
    requestBody: {
      title: input.title,
      notes: input.notes ?? undefined,
      due: input.dueDate ? toRfc3339Date(input.dueDate) : undefined,
    },
  });
  return {
    id: res.data.id ?? "",
    title: res.data.title ?? input.title,
  };
}
