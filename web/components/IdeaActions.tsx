"use client";

import { useState, useTransition } from "react";
import {
  ideaActToday,
  ideaSchedule,
  ideaPushNextWeek,
  ideaKeepQuiet,
} from "@/lib/actions/ideas";

export function IdeaActions({ ideaId }: { ideaId: number }) {
  const [pending, startTransition] = useTransition();
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [date, setDate] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const res = await fn();
      setMsg(res.ok ? "✓ done" : `error: ${res.error ?? "unknown"}`);
      setTimeout(() => setMsg(null), 3000);
    });
  }

  if (scheduleOpen) {
    return (
      <div className="mt-2 flex items-center gap-2 text-xs">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded border border-bone bg-cream px-2 py-1 text-ink"
        />
        <button
          onClick={() => run(() => ideaSchedule(ideaId, date))}
          disabled={pending || !date}
          className="rounded bg-plum text-cream px-2 py-1 hover:bg-oxblood disabled:opacity-50"
        >
          set
        </button>
        <button
          onClick={() => setScheduleOpen(false)}
          className="text-smoke hover:text-ink"
        >
          cancel
        </button>
        {msg && <span className="text-smoke">{msg}</span>}
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <button
        onClick={() => run(() => ideaActToday(ideaId))}
        disabled={pending}
        className="text-sage hover:text-ink hover:underline disabled:opacity-50 transition"
      >
        Act today
      </button>
      <span className="text-bone">·</span>
      <button
        onClick={() => setScheduleOpen(true)}
        disabled={pending}
        className="text-plum hover:text-ink hover:underline disabled:opacity-50 transition"
      >
        Schedule
      </button>
      <span className="text-bone">·</span>
      <button
        onClick={() => run(() => ideaPushNextWeek(ideaId))}
        disabled={pending}
        className="text-rust hover:text-ink hover:underline disabled:opacity-50 transition"
      >
        Push to next week
      </button>
      <span className="text-bone">·</span>
      <button
        onClick={() => run(() => ideaKeepQuiet(ideaId))}
        disabled={pending}
        className="text-ash hover:text-ink hover:underline disabled:opacity-50 transition"
      >
        Keep quiet
      </button>
      {msg && <span className="ml-2 text-smoke">{msg}</span>}
    </div>
  );
}
