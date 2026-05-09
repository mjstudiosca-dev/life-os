import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import type { PrayerEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PrayerPage() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("prayer_roster")
    .select("*")
    .neq("type", "archived")
    .order("name", { ascending: true });

  const people = (data ?? []) as PrayerEntry[];

  return (
    <main className="mx-auto max-w-2xl px-5 pt-10 pb-32">
      <header className="mb-8 flex items-baseline justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-ash mb-1">
            Held in prayer
          </p>
          <h1 className="font-serif text-4xl text-oxblood">Roster</h1>
        </div>
        <Link href="/today" className="text-sm text-smoke hover:text-ink">
          ← today
        </Link>
      </header>

      <ul className="space-y-3">
        {people.map((p) => (
          <li
            key={p.id}
            className="rounded-xl border border-bone/60 bg-sand/40 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-serif text-lg text-plum">
                  {p.name}
                  {p.relation && (
                    <span className="ml-2 text-sm text-smoke italic">
                      · {p.relation}
                    </span>
                  )}
                </p>
                <p className="mt-1 text-sm text-ink">{p.situation}</p>
              </div>
              <div className="text-[11px] uppercase tracking-wider text-ash text-right whitespace-nowrap">
                <div>{p.type.replace("_", " ")}</div>
                {p.date && <div className="text-rust">{p.date}</div>}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {people.length === 0 && (
        <p className="text-smoke italic font-serif">
          No prayer entries.{" "}
          <Link href="/capture" className="underline hover:text-ink">
            Add one →
          </Link>
        </p>
      )}
    </main>
  );
}
