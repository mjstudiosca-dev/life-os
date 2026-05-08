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
    <main className="mx-auto max-w-2xl px-5 py-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-light">Prayer Roster</h1>
        <Link href="/today" className="text-sm text-zinc-400 hover:text-zinc-100">
          ← today
        </Link>
      </header>

      <ul className="space-y-2">
        {people.map((p) => (
          <li
            key={p.id}
            className="rounded-xl border border-zinc-900 bg-zinc-950/40 p-4"
          >
            <div className="flex justify-between items-start gap-3">
              <div>
                <p className="text-zinc-100">
                  {p.name}
                  {p.relation && (
                    <span className="text-zinc-500"> · {p.relation}</span>
                  )}
                </p>
                <p className="text-sm text-zinc-400 mt-1">{p.situation}</p>
              </div>
              <div className="text-xs text-zinc-600 text-right whitespace-nowrap">
                <div>{p.type}</div>
                {p.date && <div>{p.date}</div>}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {people.length === 0 && (
        <p className="text-sm text-zinc-500">
          No prayer entries. <Link href="/capture" className="underline">Add one →</Link>
        </p>
      )}
    </main>
  );
}
