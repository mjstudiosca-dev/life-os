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
          className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-zinc-100"
        />
        <button
          onClick={() => run(() => ideaSchedule(ideaId, date))}
          disabled={pending || !date}
          className="rounded bg-zinc-100 text-zinc-900 px-2 py-1 hover:bg-white disabled:opacity-50"
        >
          set
        </button>
        <button
          onClick={() => setScheduleOpen(false)}
          className="text-zinc-500 hover:text-zinc-300"
        >
          cancel
        </button>
        {msg && <span className="text-zinc-400">{msg}</span>}
      </div>
    );
  }

  return (
    <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
      <button
        onClick={() => run(() => ideaActToday(ideaId))}
        disabled={pending}
        className="hover:text-emerald-400 disabled:opacity-50"
      >
        Act today
      </button>
      <span className="text-zinc-700">·</span>
      <button
        onClick={() => setScheduleOpen(true)}
        disabled={pending}
        className="hover:text-blue-400 disabled:opacity-50"
      >
        Schedule
      </button>
      <span className="text-zinc-700">·</span>
      <button
        onClick={() => run(() => ideaPushNextWeek(ideaId))}
        disabled={pending}
        className="hover:text-amber-400 disabled:opacity-50"
      >
        Push to next week
      </button>
      <span className="text-zinc-700">·</span>
      <button
        onClick={() => run(() => ideaKeepQuiet(ideaId))}
        disabled={pending}
        className="hover:text-zinc-300 disabled:opacity-50"
      >
        Keep quiet
      </button>
      {msg && <span className="ml-2 text-zinc-400">{msg}</span>}
    </div>
  );
}
