// Smoke test: verifies Google Tasks OAuth + connector is working end-to-end.
// Creates a single test task and prints the resulting id.
//
// Run: DRY_RUN=false npx tsx scripts/smoke-test-tasks.ts

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createTask } from "../connectors/tasks.js";

function loadDotenv(): void {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim();
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

async function main(): Promise<void> {
  loadDotenv();
  const result = await createTask({
    title: "Auth smoke test from Claude",
    notes: "If you see this in Google Tasks, OAuth and the connector are wired correctly.",
    dueDate: null,
  });
  console.log("SUCCESS:", JSON.stringify(result));
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("FAILED:", msg);
  process.exit(1);
});
