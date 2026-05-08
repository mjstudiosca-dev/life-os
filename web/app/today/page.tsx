import Link from "next/link";
import { composeBrief } from "@/lib/brief";
import { IdeaActions } from "@/components/IdeaActions";
import { TaskCheckbox } from "@/components/TaskCheckbox";
import { EnableNotifications } from "@/components/EnableNotifications";

export const dynamic = "force-dynamic";

function formatLongDate(iso: string, dayOfWeek: string): string {
  const d = new Date(iso + "T00:00:00");
  const month = d.toLocaleString("en-US", { month: "long" });
  return `${dayOfWeek}, ${month} ${d.getDate()}`;
}

export default async function TodayPage() {
  const brief = await composeBrief();

  return (
    <main className="mx-auto max-w-2xl px-5 py-6 pb-24">
      <header className="mb-6">
        <h1 className="text-2xl font-light">
          {formatLongDate(brief.date, brief.day_of_week)}
        </h1>
        <p className="text-sm text-zinc-500">Good morning.</p>
      </header>

      {/* TASKS */}
      {brief.tasks.length > 0 && (
        <Section icon="📋" title="Tasks">
          <ul className="space-y-2">
            {brief.tasks.map((t) => (
              <li key={t.id} className="text-sm flex items-start">
                <TaskCheckbox taskId={t.id} />
                <span className="flex-1">
                  <span className="text-zinc-100">{t.title}</span>
                  {t.notes && (
                    <span className="text-zinc-500"> — {t.notes.split("\n")[0]}</span>
                  )}
                  {t.due_date && (
                    <span className="text-zinc-600"> · due {t.due_date}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* PRACTICE & DEVOTION */}
      <Section icon="📖" title="Practice & devotion">
        <ul className="space-y-1.5 text-sm">
          <li>{brief.bible.proverbs}</li>
          <li>{brief.bible.psalms}</li>
          <li>
            Gospels: {brief.bible.gospels.reading}
            {brief.bible.gospels.days_until_end !== null &&
              brief.bible.gospels.days_until_end <= 2 && (
                <span className="text-amber-400">
                  {" "}
                  (finishing soon — what's next?)
                </span>
              )}
          </li>
          <li>
            Isaiah: {brief.bible.isaiah.reading}
            {brief.bible.isaiah.days_until_end !== null &&
              brief.bible.isaiah.days_until_end <= 2 && (
                <span className="text-amber-400">
                  {" "}
                  (finishing soon — what's next?)
                </span>
              )}
          </li>
          {brief.practice_goals.map((g) => (
            <li key={g.id}>
              {g.label}
              {g.scope && <span className="text-zinc-500"> ({g.scope})</span>}
            </li>
          ))}
          {brief.reading_goals.map((g) => (
            <li key={g.id}>
              {g.title}: pp. {g.today_start}–{g.today_end} today
              <span className="text-zinc-500">
                {" "}
                ({g.days_remaining}d left)
              </span>
            </li>
          ))}
        </ul>
      </Section>

      {/* PRAYER */}
      <Section icon="🙏" title="Praying for">
        <ul className="space-y-1.5 text-sm">
          {brief.prayer.ongoing.map((p) => (
            <li key={p.name}>
              <span className="text-zinc-100">{p.name}</span>
              <span className="text-zinc-500"> — {p.situation}</span>
            </li>
          ))}
          {brief.prayer.date_anchored.map((p) => (
            <li key={p.name}>
              <span className="text-zinc-100">{p.name}</span>
              <span className="text-zinc-500"> — {p.situation}</span>
              <span className="text-amber-400"> (today)</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* IDEAS */}
      {(brief.ideas_time_anchored.length > 0 ||
        brief.ideas_rotating.length > 0) && (
        <Section icon="💡" title="From your idea brain">
          <ul className="space-y-3">
            {[...brief.ideas_time_anchored, ...brief.ideas_rotating].map((i) => (
              <li key={i.id} className="text-sm">
                <div>
                  <span className="text-zinc-100">{i.title}</span>
                  {i.categories.length > 0 && (
                    <span className="text-zinc-600">
                      {" "}
                      [{i.categories.join(", ")}]
                    </span>
                  )}
                  {i.due_date && (
                    <span className="text-amber-400"> (due {i.due_date})</span>
                  )}
                </div>
                <IdeaActions ideaId={i.id} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* BODY */}
      <Section icon="🏋" title="Body">
        <ul className="space-y-1.5 text-sm">
          {brief.body.last_workout ? (
            <li>
              Last trained: {brief.body.days_since_workout} day
              {brief.body.days_since_workout === 1 ? "" : "s"} ago (
              {brief.body.last_workout.type})
            </li>
          ) : (
            <li className="text-zinc-500">No workouts logged yet</li>
          )}
          <li>
            This week: {brief.body.workouts_this_week} /{" "}
            {brief.body.weekly_target} sessions
          </li>
          {brief.body.calories_avg_7d !== null && (
            <li>
              7-day avg: {brief.body.calories_avg_7d} cal /{" "}
              {brief.body.protein_avg_7d ?? "—"}g protein (target{" "}
              {brief.body.protein_target}g)
            </li>
          )}
        </ul>
      </Section>

      <EnableNotifications />

      <nav className="mt-10 flex gap-3 flex-wrap text-sm">
        <NavLink href="/capture">Capture</NavLink>
        <NavLink href="/ideas">Ideas</NavLink>
        <NavLink href="/body">Body</NavLink>
        <NavLink href="/reading">Reading</NavLink>
        <NavLink href="/prayer">Prayer</NavLink>
        <NavLink href="/history">History</NavLink>
      </nav>
    </main>
  );
}

function Section({
  icon,
  title,
  href,
  children,
}: {
  icon: string;
  title: string;
  href?: string;
  children: React.ReactNode;
}) {
  const inner = (
    <div className="rounded-xl border border-zinc-900 bg-zinc-950/40 p-4 mb-3">
      <h2 className="text-xs uppercase tracking-wide text-zinc-500 mb-3">
        <span className="mr-2">{icon}</span>
        {title}
      </h2>
      {children}
    </div>
  );
  return href ? (
    <Link href={href as any} className="block hover:opacity-90">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function NavLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href as any}
      className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-300 hover:border-zinc-600"
    >
      {children}
    </Link>
  );
}
