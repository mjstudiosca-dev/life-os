// One-time migration: move TODO-categorized active rows from Supabase
// `ideas` into Google Tasks. After successful create in Google Tasks, the
// source row is marked `status = 'archived_to_gtasks'` so the Idea Brain
// queries (which filter `status = 'active'`) stop surfacing them.
//
// Idempotent — already-archived rows are skipped.
// Honors DRY_RUN (env var or .env). DRY_RUN=true prints the plan only.
//
// Run:
//   DRY_RUN=true  npx tsx scripts/migrate-todos-to-gtasks.ts   # preview
//   DRY_RUN=false npx tsx scripts/migrate-todos-to-gtasks.ts   # execute

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createTask } from "../connectors/tasks.js";

// ---------------------------------------------------------------------------
// Bootstrap: load .env into process.env, resolve DRY_RUN
// ---------------------------------------------------------------------------

const ROOT = process.cwd();
const ENV_FILE = resolve(ROOT, ".env");

function loadDotenv(): void {
  if (!existsSync(ENV_FILE)) return;
  const text = readFileSync(ENV_FILE, "utf8");
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

function isDryRun(): boolean {
  const raw = process.env["DRY_RUN"];
  if (raw === undefined) return true;       // safe default
  return raw.toLowerCase() !== "false";
}

// ---------------------------------------------------------------------------
// Supabase helpers (HTTP via PostgREST, no client lib)
// ---------------------------------------------------------------------------

function supabaseEnv(): { url: string; key: string } {
  const url = process.env["IDEA_BRAIN_SUPABASE_URL"];
  const key = process.env["IDEA_BRAIN_SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) {
    throw new Error(
      "Missing IDEA_BRAIN_SUPABASE_URL and/or IDEA_BRAIN_SUPABASE_SERVICE_ROLE_KEY in .env.",
    );
  }
  return { url: url.replace(/\/$/, ""), key };
}

async function supabaseFetch(path: string, init: RequestInit): Promise<Response> {
  const { url, key } = supabaseEnv();
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  return fetch(`${url}${path}`, { ...init, headers });
}

type TodoRow = {
  id: number;
  title: string;
  body: string | null;
  due_date: string | null;
};

async function fetchActiveTodos(): Promise<TodoRow[]> {
  // PostgREST query: ideas joined to idea_categories joined to categories.
  // Filter: status = active, category name = 'TODO'.
  // Use a select-with-embedded-relations syntax.
  const path =
    "/rest/v1/ideas" +
    "?select=id,title,body,due_date,idea_categories!inner(category_id,categories!inner(name))" +
    "&status=eq.active" +
    "&idea_categories.categories.name=eq.TODO";
  const res = await supabaseFetch(path, { method: "GET" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase query failed (${res.status}): ${text}`);
  }
  type RawRow = TodoRow & { idea_categories: unknown };
  const rows = (await res.json()) as RawRow[];
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    due_date: r.due_date,
  }));
}

async function archiveIdea(ideaId: number, externalRef: string): Promise<void> {
  const path = `/rest/v1/ideas?id=eq.${ideaId}`;
  const res = await supabaseFetch(path, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      status: "archived_to_gtasks",
      external_ref: externalRef,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase archive failed for id ${ideaId} (${res.status}): ${text}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  loadDotenv();
  const dryRun = isDryRun();

  console.log(`Migration: Supabase TODO ideas → Google Tasks`);
  console.log(`DRY_RUN = ${dryRun}`);
  console.log("");

  const todos = await fetchActiveTodos();
  if (todos.length === 0) {
    console.log("No active TODO-category rows to migrate. Nothing to do.");
    return;
  }

  console.log(`Found ${todos.length} active TODO-category row(s):`);
  for (const t of todos) {
    const due = t.due_date ? ` (due ${t.due_date})` : "";
    console.log(`  • [${t.id}] ${t.title}${due}`);
  }
  console.log("");

  if (dryRun) {
    console.log("DRY_RUN is on — no writes performed.");
    console.log("Re-run with DRY_RUN=false to migrate.");
    return;
  }

  let succeeded = 0;
  let failed = 0;
  for (const t of todos) {
    try {
      const created = await createTask({
        title: t.title,
        notes: t.body,
        dueDate: t.due_date,
      });
      await archiveIdea(t.id, created.id);
      console.log(`  ✓ id ${t.id} → google task ${created.id}`);
      succeeded++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ id ${t.id} failed: ${msg}`);
      failed++;
    }
  }

  console.log("");
  console.log(`Migration done. ${succeeded} succeeded, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("migrate-todos-to-gtasks.ts failed:", err);
  process.exit(1);
});
