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
    <main className="mx-auto max-w-2xl px-5 pt-10 pb-32">
      <header className="mb-8 flex items-baseline justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-ash mb-1">
            Recent briefs
          </p>
          <h1 className="font-serif text-4xl text-oxblood">History</h1>
        </div>
        <Link href="/today" className="text-sm text-smoke hover:text-ink">
          ← today
        </Link>
      </header>

      {briefs.length === 0 ? (
        <p className="text-smoke italic font-serif">
          No briefs archived yet. The morning cron starts populating this once
          it runs.
        </p>
      ) : (
        <ul className="space-y-2">
          {briefs.map((b) => (
            <li
              key={b.id}
              className="rounded-xl border border-bone/60 bg-sand/40 px-4 py-3 flex items-baseline justify-between"
            >
              <span className="font-serif text-lg text-oxblood">{b.date}</span>
              <span className="text-[11px] uppercase tracking-wider text-ash">
                {b.delivered_via ?? "—"}
                {b.read_at && (
                  <span className="ml-2 text-sage">read</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
