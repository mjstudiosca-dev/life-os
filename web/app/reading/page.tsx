import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import type { ReadingGoal } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ReadingPage() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("reading_goals")
    .select("*")
    .order("status", { ascending: true })
    .order("target_date", { ascending: true });

  const goals = (data ?? []) as ReadingGoal[];

  return (
    <main className="mx-auto max-w-2xl px-5 py-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-light">Reading</h1>
        <Link href="/today" className="text-sm text-zinc-400 hover:text-zinc-100">
          ← today
        </Link>
      </header>

      {goals.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No reading goals. <Link href="/capture" className="underline">Add one →</Link>
        </p>
      ) : (
        <ul className="space-y-3">
          {goals.map((g) => {
            const pct = Math.min(100, Math.round((g.current_page / g.total_pages) * 100));
            return (
              <li
                key={g.id}
                className="rounded-xl border border-zinc-900 bg-zinc-950/40 p-4"
              >
                <div className="flex justify-between items-baseline mb-2">
                  <p className="text-zinc-100">{g.title}</p>
                  <p className="text-xs text-zinc-500">
                    {g.current_page} / {g.total_pages} ({pct}%)
                  </p>
                </div>
                <div className="h-1 rounded bg-zinc-900 overflow-hidden">
                  <div className="h-full bg-zinc-300" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-zinc-500 mt-2">
                  Target: {g.target_date} · {g.status}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
