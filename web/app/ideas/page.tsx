import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import type { Idea } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function IdeasPage() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("ideas")
    .select("id, title, body, status, due_date, last_surfaced_at, surface_count, is_time_anchored, source")
    .neq("status", "archived_to_gtasks")
    .order("created_at", { ascending: false });

  const ideas = (data ?? []) as Pick<
    Idea,
    "id" | "title" | "body" | "status" | "due_date" | "last_surfaced_at" | "surface_count" | "is_time_anchored" | "source"
  >[];

  return (
    <main className="mx-auto max-w-2xl px-5 py-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-light">Idea Brain</h1>
        <Link href="/today" className="text-sm text-zinc-400 hover:text-zinc-100">
          ← today
        </Link>
      </header>

      {error && (
        <p className="text-sm text-red-400 mb-4">Error: {error.message}</p>
      )}

      <ul className="space-y-3">
        {ideas.map((idea) => (
          <li
            key={idea.id}
            className="rounded-xl border border-zinc-900 bg-zinc-950/40 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-zinc-100">{idea.title}</p>
                {idea.body && (
                  <p className="text-sm text-zinc-500 mt-1 line-clamp-2">{idea.body}</p>
                )}
                <div className="mt-2 flex gap-3 text-xs text-zinc-600">
                  <span>{idea.status}</span>
                  {idea.is_time_anchored && <span className="text-amber-500">time-anchored</span>}
                  {idea.due_date && <span>due {idea.due_date}</span>}
                  <span>surfaced {idea.surface_count}×</span>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {ideas.length === 0 && !error && (
        <p className="text-sm text-zinc-500">No ideas yet. <Link href="/capture" className="underline">Capture one →</Link></p>
      )}
    </main>
  );
}
