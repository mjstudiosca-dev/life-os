import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import type { Idea } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function IdeasPage() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("ideas")
    .select(
      "id, title, body, status, due_date, last_surfaced_at, surface_count, is_time_anchored, source",
    )
    .neq("status", "archived_to_gtasks")
    .order("created_at", { ascending: false });

  const ideas = (data ?? []) as Pick<
    Idea,
    | "id"
    | "title"
    | "body"
    | "status"
    | "due_date"
    | "last_surfaced_at"
    | "surface_count"
    | "is_time_anchored"
    | "source"
  >[];

  return (
    <main className="mx-auto max-w-2xl px-5 pt-10 pb-32">
      <header className="mb-8 flex items-baseline justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-ash mb-1">
            Brain
          </p>
          <h1 className="font-serif text-4xl text-oxblood">Ideas</h1>
        </div>
        <Link href="/today" className="text-sm text-smoke hover:text-ink">
          ← today
        </Link>
      </header>

      {error && (
        <p className="text-sm text-rust mb-4">Error: {error.message}</p>
      )}

      <ul className="space-y-3">
        {ideas.map((idea) => (
          <li
            key={idea.id}
            className="rounded-xl border border-bone/60 bg-sand/40 p-4"
          >
            <p className="text-ink">{idea.title}</p>
            {idea.body && (
              <p className="mt-1.5 text-sm text-smoke font-serif italic line-clamp-2">
                {idea.body}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] uppercase tracking-wider text-ash">
              <span>{idea.status}</span>
              {idea.is_time_anchored && (
                <span className="text-rust">time-anchored</span>
              )}
              {idea.due_date && (
                <span className="text-rust">due {idea.due_date}</span>
              )}
              <span>surfaced {idea.surface_count}×</span>
            </div>
          </li>
        ))}
      </ul>

      {ideas.length === 0 && !error && (
        <p className="text-smoke italic font-serif">
          No ideas yet.{" "}
          <Link href="/capture" className="underline hover:text-ink">
            Capture one →
          </Link>
        </p>
      )}
    </main>
  );
}
