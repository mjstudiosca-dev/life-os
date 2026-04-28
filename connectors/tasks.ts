// Stub for Google Tasks writes. See connectors/calendar.ts for the rationale.

export type TaskInput = {
  title: string;
  notes: string | null;
  dueDate: string | null;   // ISO date "2026-04-28" or null
};

export async function createTask(input: TaskInput): Promise<void> {
  console.log("[STUB] connectors/tasks.ts → createTask would be called with:");
  console.log(JSON.stringify(input, null, 2));
}
