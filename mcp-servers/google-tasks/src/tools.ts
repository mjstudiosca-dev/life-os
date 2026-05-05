// Tool implementations exposed by the MCP server. Each function returns a
// JSON-serializable result that the server wraps in the MCP response shape.

import { google } from "googleapis";
import { getAuthorizedClient } from "./auth.js";

const DEFAULT_TASKLIST = "@default";

function tasksApi() {
  const auth = getAuthorizedClient();
  return google.tasks({ version: "v1", auth });
}

// ---------------------------------------------------------------------------
// list_pending_tasks
// ---------------------------------------------------------------------------

export type PendingTask = {
  id: string;
  title: string;
  notes: string | null;
  due: string | null;            // ISO date "YYYY-MM-DD" or null
  status: string;                // "needsAction" for pending
};

export type ListPendingTasksArgs = {
  due_before?: string;            // ISO date — optional filter
};

export async function listPendingTasks(
  args: ListPendingTasksArgs = {},
): Promise<PendingTask[]> {
  const tasks = tasksApi();
  const res = await tasks.tasks.list({
    tasklist: DEFAULT_TASKLIST,
    showCompleted: false,
    showHidden: false,
    maxResults: 100,
    ...(args.due_before ? { dueMax: toRfc3339Date(args.due_before) } : {}),
  });
  const items = res.data.items ?? [];
  return items
    .filter((t) => t.status !== "completed")
    .map((t) => ({
      id: t.id ?? "",
      title: t.title ?? "(untitled)",
      notes: t.notes ?? null,
      due: t.due ? t.due.slice(0, 10) : null,
      status: t.status ?? "needsAction",
    }));
}

// ---------------------------------------------------------------------------
// create_task
// ---------------------------------------------------------------------------

export type CreateTaskArgs = {
  title: string;
  notes?: string | null;
  due?: string | null;            // ISO date "YYYY-MM-DD"
};

export type CreateTaskResult = {
  id: string;
  title: string;
};

export async function createTask(args: CreateTaskArgs): Promise<CreateTaskResult> {
  const tasks = tasksApi();
  const res = await tasks.tasks.insert({
    tasklist: DEFAULT_TASKLIST,
    requestBody: {
      title: args.title,
      notes: args.notes ?? undefined,
      due: args.due ? toRfc3339Date(args.due) : undefined,
    },
  });
  return {
    id: res.data.id ?? "",
    title: res.data.title ?? args.title,
  };
}

// ---------------------------------------------------------------------------
// complete_task
// ---------------------------------------------------------------------------

export type CompleteTaskArgs = {
  id: string;
};

export type CompleteTaskResult = {
  id: string;
  status: string;
};

export async function completeTask(args: CompleteTaskArgs): Promise<CompleteTaskResult> {
  const tasks = tasksApi();
  const res = await tasks.tasks.patch({
    tasklist: DEFAULT_TASKLIST,
    task: args.id,
    requestBody: { status: "completed" },
  });
  return {
    id: res.data.id ?? args.id,
    status: res.data.status ?? "completed",
  };
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function toRfc3339Date(isoDate: string): string {
  // Google Tasks API expects an RFC 3339 timestamp for `due`. Date-only
  // values in Google Tasks default to T00:00:00.000Z and are interpreted
  // as a date (Google ignores the time component for due dates).
  return `${isoDate}T00:00:00.000Z`;
}
