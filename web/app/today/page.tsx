import Link from "next/link";
import { composeBrief } from "@/lib/brief";
import type { CalendarEventLite } from "@/lib/types";
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
    <main className="mx-auto max-w-2xl px-5 pt-10 pb-32">
      <header className="mb-10">
        <p className="text-[11px] uppercase tracking-[0.22em] text-ash mb-2">
          Today
        </p>
        <h1 className="font-serif text-5xl leading-tight text-oxblood">
          {formatLongDate(brief.date, brief.day_of_week)}
        </h1>
        <p className="mt-3 text-smoke italic font-serif text-lg">
          Good morning.
        </p>
      </header>

      {/* CALENDAR */}
      {brief.calendar.available ? (
        (brief.calendar.tier1.length > 0 ||
          brief.calendar.tier2.length > 0 ||
          brief.calendar.tier3.length > 0) && (
          <Section icon="🗓" title="Today">
            {brief.calendar.tier1.length > 0 && (
              <CalGroup
                label="Locked in"
                accent="text-oxblood"
                events={brief.calendar.tier1}
              />
            )}
            {brief.calendar.tier2.length > 0 && (
              <CalGroup
                label="Plan today"
                accent="text-plum"
                events={brief.calendar.tier2}
              />
            )}
            {brief.calendar.tier3.length > 0 && (
              <CalGroup
                label="Optional"
                accent="text-mustard"
                events={brief.calendar.tier3}
              />
            )}
          </Section>
        )
      ) : (
        <p className="text-xs text-rust mb-6">
          Calendar unavailable — check Google auth.
        </p>
      )}

      {/* TASKS */}
      {brief.tasks.length > 0 && (
        <Section icon="📋" title="Tasks">
          <ul className="divide-y divide-bone/60">
            {brief.tasks.map((t) => (
              <li key={t.id} className="py-2.5 flex items-start gap-3">
                <TaskCheckbox taskId={t.id} />
                <div className="flex-1 min-w-0">
                  <span className="text-ink">{t.title}</span>
                  {t.notes && (
                    <span className="text-smoke">
                      {" "}
                      — {t.notes.split("\n")[0]}
                    </span>
                  )}
                  {t.due_date && (
                    <span className="ml-2 text-xs text-rust">
                      due {t.due_date}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* PRACTICE & DEVOTION */}
      <Section icon="📖" title="Practice & devotion">
        <ul className="space-y-2 text-ink">
          <BibleRow label="Proverbs" value={brief.bible.proverbs} />
          <BibleRow label="Psalms" value={brief.bible.psalms} />
          <BibleRow
            label="Gospels"
            value={brief.bible.gospels.reading}
            warn={
              brief.bible.gospels.days_until_end !== null &&
              brief.bible.gospels.days_until_end <= 2
            }
          />
          <BibleRow
            label="Isaiah"
            value={brief.bible.isaiah.reading}
            warn={
              brief.bible.isaiah.days_until_end !== null &&
              brief.bible.isaiah.days_until_end <= 2
            }
          />
          {brief.practice_goals.map((g) => (
            <li key={g.id} className="flex items-baseline gap-3">
              <span className="font-serif italic text-rust w-20 shrink-0">
                Practice
              </span>
              <span>
                {g.label}
                {g.scope && <span className="text-smoke"> · {g.scope}</span>}
              </span>
            </li>
          ))}
          {brief.reading_goals.map((g) => (
            <li key={g.id} className="flex items-baseline gap-3">
              <span className="font-serif italic text-rust w-20 shrink-0">
                Reading
              </span>
              <span>
                {g.title}:{" "}
                {g.not_started ? (
                  <span className="text-smoke">
                    starts in {g.days_until_start}d ({g.start_date})
                  </span>
                ) : (
                  <>
                    pp. {g.today_start}–{g.today_end}
                    <span className="text-smoke">
                      {" "}
                      ({g.days_remaining}d left)
                    </span>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      {/* PRAYER */}
      <Section icon="🙏" title="Praying for">
        <ul className="space-y-2.5">
          {brief.prayer.ongoing.map((p) => (
            <li key={p.name} className="text-ink">
              <span className="font-serif italic text-plum">{p.name}</span>
              <span className="text-smoke"> · {p.situation}</span>
            </li>
          ))}
          {brief.prayer.date_anchored.map((p) => (
            <li key={p.name} className="text-ink">
              <span className="font-serif italic text-plum">{p.name}</span>
              <span className="text-smoke"> · {p.situation}</span>
              <span className="ml-2 text-xs text-rust">today</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* IDEAS */}
      {(brief.ideas_time_anchored.length > 0 ||
        brief.ideas_rotating.length > 0) && (
        <Section icon="💡" title="From your idea brain">
          <ul className="space-y-5">
            {[...brief.ideas_time_anchored, ...brief.ideas_rotating].map(
              (i) => (
                <li key={i.id}>
                  <p className="text-ink">
                    <span className="font-medium">{i.title}</span>
                    {i.categories.length > 0 && (
                      <span className="ml-2 text-[11px] uppercase tracking-wider text-sage">
                        {i.categories.join(" · ")}
                      </span>
                    )}
                    {i.due_date && (
                      <span className="ml-2 text-xs text-rust">
                        due {i.due_date}
                      </span>
                    )}
                  </p>
                  {i.body && (
                    <p className="mt-1 text-sm text-smoke font-serif italic">
                      {(i.body.split(/[.!?]\s/)[0] || i.body).slice(0, 140)}
                      {i.body.length > 140 ? "…" : ""}
                    </p>
                  )}
                  <IdeaActions ideaId={i.id} />
                </li>
              ),
            )}
          </ul>
        </Section>
      )}

      {/* BODY */}
      <Section icon="🏋" title="Body">
        <ul className="space-y-2 text-ink">
          {brief.body.last_workout ? (
            <li className="flex items-baseline gap-3">
              <span className="font-serif italic text-sage w-24 shrink-0">
                Last trained
              </span>
              <span>
                {brief.body.days_since_workout} day
                {brief.body.days_since_workout === 1 ? "" : "s"} ago
                <span className="text-smoke"> · {brief.body.last_workout.type}</span>
              </span>
            </li>
          ) : (
            <li className="text-smoke italic">No workouts logged yet</li>
          )}
          <li className="flex items-baseline gap-3">
            <span className="font-serif italic text-sage w-24 shrink-0">
              This week
            </span>
            <span>
              {brief.body.workouts_this_week} / {brief.body.weekly_target}
              <span className="text-smoke"> sessions</span>
            </span>
          </li>
          {brief.body.calories_avg_7d !== null && (
            <li className="flex items-baseline gap-3">
              <span className="font-serif italic text-sage w-24 shrink-0">
                7-day avg
              </span>
              <span>
                {brief.body.calories_avg_7d} cal
                <span className="text-smoke">
                  {" · "}
                  {brief.body.protein_avg_7d ?? "—"}g protein (target{" "}
                  {brief.body.protein_target}g)
                </span>
              </span>
            </li>
          )}
        </ul>
      </Section>

      <p className="mt-10 text-center font-serif italic text-smoke">
        ~{brief.hours_open} hours open today. No pressure.
      </p>

      <EnableNotifications />

      <nav className="mt-12 grid grid-cols-3 gap-2 text-sm">
        <NavLink href="/capture" emphasis>
          + Capture
        </NavLink>
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
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="text-[11px] uppercase tracking-[0.22em] text-ash mb-3">
        <span className="mr-2 not-italic" aria-hidden="true">
          {icon}
        </span>
        {title}
      </h2>
      <div className="rounded-xl border border-bone/60 bg-sand/40 px-5 py-4">
        {children}
      </div>
    </section>
  );
}

function BibleRow({
  label,
  value,
  warn = false,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <li className="flex items-baseline gap-3">
      <span className="font-serif italic text-rust w-20 shrink-0">{label}</span>
      <span>
        {value}
        {warn && (
          <span className="ml-2 text-xs text-rust">finishing soon</span>
        )}
      </span>
    </li>
  );
}

function CalGroup({
  label,
  accent,
  events,
}: {
  label: string;
  accent: string;
  events: CalendarEventLite[];
}) {
  return (
    <div className="mb-3 last:mb-0">
      <p
        className={`font-serif italic text-sm ${accent} mb-1.5`}
      >
        {label}
      </p>
      <ul className="space-y-1.5">
        {events.map((e) => (
          <li key={e.id} className="flex items-baseline gap-3 text-ink">
            <span className="font-mono text-xs text-smoke shrink-0 w-20">
              {e.allDay ? "all day" : e.startTime}
            </span>
            <span className="flex-1 min-w-0">
              {e.title}
              {e.location && (
                <span className="text-smoke text-xs">
                  {" "}
                  · {e.location}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NavLink({
  href,
  emphasis = false,
  children,
}: {
  href: string;
  emphasis?: boolean;
  children: string;
}) {
  return (
    <Link
      href={href as any}
      className={`rounded-lg border px-3 py-2.5 text-center transition ${
        emphasis
          ? "border-plum bg-plum text-cream hover:bg-oxblood"
          : "border-bone bg-sand/30 text-ink hover:border-smoke"
      }`}
    >
      {children}
    </Link>
  );
}
