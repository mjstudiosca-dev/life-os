import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import type { Workout, CalorieEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BodyPage() {
  const supabase = createServiceClient();
  const since = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).toLocaleDateString("en-CA");

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
    <main className="mx-auto max-w-2xl px-5 pt-10 pb-32">
      <header className="mb-8 flex items-baseline justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-ash mb-1">
            Last 30 days
          </p>
          <h1 className="font-serif text-4xl text-oxblood">Body</h1>
        </div>
        <Link href="/today" className="text-sm text-smoke hover:text-ink">
          ← today
        </Link>
      </header>

      <Section title="Workouts">
        {workouts.length === 0 ? (
          <p className="text-smoke italic font-serif">
            No workouts logged.{" "}
            <Link href="/capture" className="underline hover:text-ink">
              Log one →
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-bone/60">
            {workouts.map((w) => (
              <li
                key={w.id}
                className="flex justify-between py-2 text-sm"
              >
                <span>
                  <span className="text-ink">{w.date}</span>
                  <span className="text-smoke"> · {w.type}</span>
                </span>
                {w.notes && (
                  <span className="text-ash truncate max-w-xs italic font-serif">
                    {w.notes}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Calories">
        {calories.length === 0 ? (
          <p className="text-smoke italic font-serif">
            No entries.{" "}
            <Link href="/capture" className="underline hover:text-ink">
              Log one →
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-bone/60">
            {calories.map((c) => (
              <li
                key={c.id}
                className="flex justify-between py-2 text-sm"
              >
                <span className="text-ink">{c.date}</span>
                <span className="text-smoke">
                  {c.calories ?? "—"} cal · {c.protein_g ?? "—"}g protein
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="text-[11px] uppercase tracking-[0.22em] text-ash mb-3">
        {title}
      </h2>
      <div className="rounded-xl border border-bone/60 bg-sand/40 px-5 py-3">
        {children}
      </div>
    </section>
  );
}
