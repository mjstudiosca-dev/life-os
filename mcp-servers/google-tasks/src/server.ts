// MCP server that exposes Google Tasks read/write to Claude Code (and, when
// hosted, to the morning-brief Cloud Routine). Stdio transport — Claude Code
// launches this process directly per the entry in `.mcp.json` (or claude
// settings).
//
// Tools:
//   list_pending_tasks  — read pending tasks for the morning brief
//   create_task         — used by capture flows
//   complete_task       — used by evening recap / email replies

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import {
  listPendingTasks,
  createTask,
  completeTask,
  type ListPendingTasksArgs,
  type CreateTaskArgs,
  type CompleteTaskArgs,
} from "./tools.js";

const TOOL_DEFINITIONS = [
  {
    name: "list_pending_tasks",
    description:
      "List pending (incomplete) tasks from the user's default Google Tasks list. Optionally filter to tasks due on or before a given ISO date.",
    inputSchema: {
      type: "object",
      properties: {
        due_before: {
          type: "string",
          description:
            "Optional ISO date (YYYY-MM-DD). If set, only tasks due on or before this date are returned.",
        },
      },
    },
  },
  {
    name: "create_task",
    description:
      "Create a new task in the user's default Google Tasks list. Returns the new task's id.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Task title (required)." },
        notes: { type: "string", description: "Optional notes / body." },
        due: {
          type: "string",
          description: "Optional ISO date (YYYY-MM-DD) for the due date.",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "complete_task",
    description:
      "Mark a task as completed. The task remains in Google Tasks (hidden from default views) but is marked done.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Google Tasks task id." },
      },
      required: ["id"],
    },
  },
] as const;

const server = new Server(
  {
    name: "google-tasks",
    version: "0.1.0",
  },
  {
    capabilities: { tools: {} },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOL_DEFINITIONS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    const result = await dispatch(name, args ?? {});
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      isError: true,
      content: [{ type: "text", text: `Error: ${message}` }],
    };
  }
});

async function dispatch(name: string, raw: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "list_pending_tasks":
      return listPendingTasks(raw as ListPendingTasksArgs);
    case "create_task":
      if (typeof raw["title"] !== "string") {
        throw new Error("create_task requires a string `title`.");
      }
      return createTask(raw as CreateTaskArgs);
    case "complete_task":
      if (typeof raw["id"] !== "string") {
        throw new Error("complete_task requires a string `id`.");
      }
      return completeTask(raw as CompleteTaskArgs);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Stay alive — stdio transport drives the lifecycle.
}

main().catch((err) => {
  console.error("[mcp-google-tasks] fatal:", err);
  process.exit(1);
});
