"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { capture } from "@/lib/actions/capture";

type Type = "idea" | "task" | "prayer" | "workout" | "calorie" | "reading_goal";

const TYPE_LABELS: Record<Type, string> = {
  idea: "Idea",
  task: "Task",
  prayer: "Prayer",
  workout: "Workout",
  calorie: "Calorie",
  reading_goal: "Reading goal",
};

const PLACEHOLDERS: Record<Type, string> = {
  idea: "What if I built a small habit tracker tied to my morning brief…",
  task: "Buy AirTag for keys",
  prayer: "Pray for safe travel this weekend",
  workout: "Push day — chest, shoulders, triceps. Felt strong.",
  calorie: "Tracked 2400 cal, 180g protein. Skipped breakfast.",
  reading_goal: "Living Fearless",
};

export default function CapturePage() {
  const [type, setType] = useState<Type>("idea");
  const [text, setText] = useState("");
  const [extras, setExtras] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  function setExtra(key: string, value: string) {
    setExtras((prev) => ({ ...prev, [key]: value }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await capture(type, text, extras);
      if (res.ok) {
        setResult({ ok: true, message: res.message });
        setText("");
        setExtras({});
      } else {
        setResult({ ok: false, message: res.error });
      }
    });
  }

  return (
    <main className="mx-auto max-w-xl px-5 pt-10 pb-32">
      <header className="mb-8 flex items-baseline justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-ash mb-1">
            New entry
          </p>
          <h1 className="font-serif text-4xl text-oxblood">Capture</h1>
        </div>
        <Link href="/today" className="text-sm text-smoke hover:text-ink">
          ← today
        </Link>
      </header>

      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-ash mb-2">
            Type
          </p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(TYPE_LABELS) as Type[]).map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => setType(t)}
                className={`rounded-lg px-3 py-1.5 text-sm border transition ${
                  type === t
                    ? "border-plum bg-plum text-cream"
                    : "border-bone bg-sand/40 text-ink hover:border-smoke"
                }`}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <textarea
          required
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={PLACEHOLDERS[type]}
          className="w-full rounded-lg border border-bone bg-cream px-4 py-3 text-ink placeholder:text-ash focus:border-smoke focus:outline-none"
        />

        {/* Conditional extras */}
        {type === "task" && (
          <Field label="Due date (optional)">
            <input
              type="date"
              value={extras.due_date ?? ""}
              onChange={(e) => setExtra("due_date", e.target.value)}
              className="w-full rounded-lg border border-bone bg-cream px-4 py-3 text-ink"
            />
          </Field>
        )}
        {type === "prayer" && (
          <>
            <Field label="Name">
              <input
                type="text"
                required
                value={extras.name ?? ""}
                onChange={(e) => setExtra("name", e.target.value)}
                placeholder="e.g., Hayden"
                className="w-full rounded-lg border border-bone bg-cream px-4 py-3 text-ink placeholder:text-ash"
              />
            </Field>
            <Field label="Relation (optional)">
              <input
                type="text"
                value={extras.relation ?? ""}
                onChange={(e) => setExtra("relation", e.target.value)}
                placeholder="friend, family, etc."
                className="w-full rounded-lg border border-bone bg-cream px-4 py-3 text-ink placeholder:text-ash"
              />
            </Field>
            <Field label="Date (only if anchored to a specific day)">
              <input
                type="date"
                value={extras.date ?? ""}
                onChange={(e) => setExtra("date", e.target.value)}
                className="w-full rounded-lg border border-bone bg-cream px-4 py-3 text-ink"
              />
            </Field>
          </>
        )}
        {type === "workout" && (
          <Field label="Type">
            <select
              required
              value={extras.type ?? ""}
              onChange={(e) => setExtra("type", e.target.value)}
              className="w-full rounded-lg border border-bone bg-cream px-4 py-3 text-ink"
            >
              <option value="">workout type…</option>
              <option value="lift">lift</option>
              <option value="cardio">cardio</option>
              <option value="mobility">mobility</option>
              <option value="rest">rest day</option>
              <option value="other">other</option>
            </select>
          </Field>
        )}
        {type === "calorie" && (
          <div className="flex gap-2">
            <Field label="Calories" className="flex-1">
              <input
                type="number"
                value={extras.calories ?? ""}
                onChange={(e) => setExtra("calories", e.target.value)}
                placeholder="2400"
                className="w-full rounded-lg border border-bone bg-cream px-4 py-3 text-ink placeholder:text-ash"
              />
            </Field>
            <Field label="Protein (g)" className="flex-1">
              <input
                type="number"
                value={extras.protein_g ?? ""}
                onChange={(e) => setExtra("protein_g", e.target.value)}
                placeholder="180"
                className="w-full rounded-lg border border-bone bg-cream px-4 py-3 text-ink placeholder:text-ash"
              />
            </Field>
          </div>
        )}
        {type === "reading_goal" && (
          <>
            <Field label="Total pages">
              <input
                type="number"
                required
                value={extras.total_pages ?? ""}
                onChange={(e) => setExtra("total_pages", e.target.value)}
                placeholder="190"
                className="w-full rounded-lg border border-bone bg-cream px-4 py-3 text-ink placeholder:text-ash"
              />
            </Field>
            <Field label="Target completion date">
              <input
                type="date"
                required
                value={extras.target_date ?? ""}
                onChange={(e) => setExtra("target_date", e.target.value)}
                className="w-full rounded-lg border border-bone bg-cream px-4 py-3 text-ink"
              />
            </Field>
          </>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-plum text-cream px-4 py-3 font-medium hover:bg-oxblood disabled:opacity-50 transition"
        >
          {pending ? "Saving…" : "Capture"}
        </button>

        {result && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              result.ok
                ? "border-sage/50 bg-sage/10 text-ink"
                : "border-rust/60 bg-rust/10 text-rust"
            }`}
          >
            {result.message}
          </div>
        )}
      </form>
    </main>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="block text-[11px] uppercase tracking-[0.22em] text-ash mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}
