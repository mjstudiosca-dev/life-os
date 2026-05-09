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
    <main className="mx-auto max-w-2xl px-5 pt-10 pb-32">
      <header className="mb-8 flex items-baseline justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-ash mb-1">
            On the page
          </p>
          <h1 className="font-serif text-4xl text-oxblood">Reading</h1>
        </div>
        <Link href="/today" className="text-sm text-smoke hover:text-ink">
          ← today
        </Link>
      </header>

      {goals.length === 0 ? (
        <p className="text-smoke italic font-serif">
          No reading goals.{" "}
          <Link href="/capture" className="underline hover:text-ink">
            Add one →
          </Link>
        </p>
      ) : (
        <ul className="space-y-4">
          {goals.map((g) => {
            const pct = Math.min(
              100,
              Math.round((g.current_page / g.total_pages) * 100),
            );
            return (
              <li
                key={g.id}
                className="rounded-xl border border-bone/60 bg-sand/40 p-5"
              >
                <div className="flex items-baseline justify-between mb-3">
                  <p className="font-serif text-xl text-oxblood">{g.title}</p>
                  <p className="text-xs text-smoke">
                    {g.current_page} / {g.total_pages}
                    <span className="ml-2 text-ash">{pct}%</span>
                  </p>
                </div>
                <div className="h-1 rounded-full bg-bone/60 overflow-hidden">
                  <div
                    className="h-full bg-plum transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-[11px] uppercase tracking-wider text-ash mt-3">
                  Target {g.target_date} · {g.status}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
