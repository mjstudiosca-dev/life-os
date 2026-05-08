"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { capture } from "@/lib/actions/capture";

type Type = "idea" | "task" | "prayer" | "workout" | "calorie" | "reading_goal";

export default function CapturePage() {
  const [type, setType] = useState<Type>("idea");
  const [text, setText] = useState("");
  const [extras, setExtras] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

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
    <main className="mx-auto max-w-xl px-5 py-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-light">Capture</h1>
        <Link
          href="/today"
          className="text-sm text-zinc-400 hover:text-zinc-100"
        >
          ← today
        </Link>
      </header>

      <form onSubmit={onSubmit} className="space-y-4">
        {/* Type picker */}
        <div className="flex flex-wrap gap-2">
          {(["idea", "task", "prayer", "workout", "calorie", "reading_goal"] as Type[]).map(
            (t) => (
              <button
                type="button"
                key={t}
                onClick={() => setType(t)}
                className={`rounded-lg px-3 py-1.5 text-sm border transition ${
                  type === t
                    ? "border-zinc-100 bg-zinc-100 text-zinc-900"
                    : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600"
                }`}
              >
                {t.replace("_", " ")}
              </button>
            ),
          )}
        </div>

        {/* Main text */}
        <textarea
          required
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholders[type]}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-600 focus:outline-none"
        />

        {/* Conditional extras */}
        {type === "task" && (
          <input
            type="date"
            value={extras.due_date ?? ""}
            onChange={(e) => setExtra("due_date", e.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-zinc-100 focus:border-zinc-600 focus:outline-none"
            placeholder="due date (optional)"
          />
        )}
        {type === "prayer" && (
          <>
            <input
              type="text"
              required
              value={extras.name ?? ""}
              onChange={(e) => setExtra("name", e.target.value)}
              placeholder="name (e.g., Hayden)"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-zinc-100 placeholder:text-zinc-500"
            />
            <input
              type="text"
              value={extras.relation ?? ""}
              onChange={(e) => setExtra("relation", e.target.value)}
              placeholder="relation (friend, family, etc.) — optional"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-zinc-100 placeholder:text-zinc-500"
            />
            <input
              type="date"
              value={extras.date ?? ""}
              onChange={(e) => setExtra("date", e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-zinc-100"
              placeholder="date (optional — for date-anchored prayers)"
            />
          </>
        )}
        {type === "workout" && (
          <select
            required
            value={extras.type ?? ""}
            onChange={(e) => setExtra("type", e.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-zinc-100"
          >
            <option value="">workout type…</option>
            <option value="lift">lift</option>
            <option value="cardio">cardio</option>
            <option value="mobility">mobility</option>
            <option value="rest">rest day</option>
            <option value="other">other</option>
          </select>
        )}
        {type === "calorie" && (
          <div className="flex gap-2">
            <input
              type="number"
              value={extras.calories ?? ""}
              onChange={(e) => setExtra("calories", e.target.value)}
              placeholder="calories"
              className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-zinc-100"
            />
            <input
              type="number"
              value={extras.protein_g ?? ""}
              onChange={(e) => setExtra("protein_g", e.target.value)}
              placeholder="protein (g)"
              className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-zinc-100"
            />
          </div>
        )}
        {type === "reading_goal" && (
          <div className="space-y-2">
            <input
              type="number"
              required
              value={extras.total_pages ?? ""}
              onChange={(e) => setExtra("total_pages", e.target.value)}
              placeholder="total pages"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-zinc-100"
            />
            <input
              type="date"
              required
              value={extras.target_date ?? ""}
              onChange={(e) => setExtra("target_date", e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-zinc-100"
              placeholder="target completion date"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-zinc-100 text-zinc-900 px-4 py-3 font-medium hover:bg-white disabled:opacity-50 transition"
        >
          {pending ? "Saving…" : "Capture"}
        </button>

        {result && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              result.ok
                ? "border-emerald-800 bg-emerald-950/40 text-emerald-200"
                : "border-red-800 bg-red-950/40 text-red-200"
            }`}
          >
            {result.message}
          </div>
        )}
      </form>
    </main>
  );
}

const placeholders: Record<Type, string> = {
  idea: "What if I built a small habit tracker tied to my morning brief…",
  task: "Buy AirTag for keys",
  prayer: "Pray for safe travel this weekend",
  workout: "Push day — chest, shoulders, triceps. Felt strong.",
  calorie: "Tracked 2400 cal, 180g protein. Skipped breakfast.",
  reading_goal: "Living Fearless",
};
