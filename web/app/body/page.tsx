import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import type { Workout, CalorieEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BodyPage() {
  const supabase = createServiceClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toLocaleDateString("en-CA");

  const [workoutsRes, calsRes] = await Promise.all([
    supabase
      .from("workouts")
      .select("*")
      .gte("date", since)
      .order("date", { ascending: false }),
    supabase
      .from("calorie_log")
      .select("*")
      .gte("date", since)
      .order("date", { ascending: false }),
  ]);

  const workouts = (workoutsRes.data ?? []) as Workout[];
  const calories = (calsRes.data ?? []) as CalorieEntry[];

  return (
    <main className="mx-auto max-w-2xl px-5 py-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-light">Body</h1>
        <Link href="/today" className="text-sm text-zinc-400 hover:text-zinc-100">
          ← today
        </Link>
      </header>

      <section className="mb-8">
        <h2 className="text-xs uppercase tracking-wide text-zinc-500 mb-3">
          🏋 Workouts (last 30 days)
        </h2>
        {workouts.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No workouts logged. <Link href="/capture" className="underline">Log one →</Link>
          </p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {workouts.map((w) => (
              <li key={w.id} className="flex justify-between border-b border-zinc-900 py-1.5">
                <span>
                  <span className="text-zinc-300">{w.date}</span>
                  <span className="text-zinc-500"> · {w.type}</span>
                </span>
                {w.notes && <span className="text-zinc-600 truncate max-w-xs">{w.notes}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-wide text-zinc-500 mb-3">
          🍴 Calories (last 30 days)
        </h2>
        {calories.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No entries. <Link href="/capture" className="underline">Log one →</Link>
          </p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {calories.map((c) => (
              <li key={c.id} className="flex justify-between border-b border-zinc-900 py-1.5">
                <span className="text-zinc-300">{c.date}</span>
                <span className="text-zinc-500">
                  {c.calories ?? "—"} cal · {c.protein_g ?? "—"}g protein
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
