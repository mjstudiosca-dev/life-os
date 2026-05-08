import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("daily_briefs")
    .select("id, date, delivered_via, delivered_at, read_at")
    .order("date", { ascending: false })
    .limit(30);

  const briefs = (data ?? []) as Array<{
    id: number;
    date: string;
    delivered_via: string | null;
    delivered_at: string | null;
    read_at: string | null;
  }>;

  return (
    <main className="mx-auto max-w-2xl px-5 py-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-light">History</h1>
        <Link href="/today" className="text-sm text-zinc-400 hover:text-zinc-100">
          ← today
        </Link>
      </header>

      {briefs.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No briefs archived yet. The morning cron will start populating this once it runs.
        </p>
      ) : (
        <ul className="space-y-2">
          {briefs.map((b) => (
            <li
              key={b.id}
              className="rounded-xl border border-zinc-900 bg-zinc-950/40 p-4 flex justify-between"
            >
              <span className="text-zinc-100">{b.date}</span>
              <span className="text-xs text-zinc-500">
                {b.delivered_via ?? "—"}
                {b.read_at && <span className="ml-2 text-emerald-400">read</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
