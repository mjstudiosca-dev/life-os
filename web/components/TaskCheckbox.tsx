"use client";

import { useTransition } from "react";
import { taskComplete } from "@/lib/actions/ideas";

export function TaskCheckbox({ taskId }: { taskId: number }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => taskComplete(taskId).then(() => {}))}
      disabled={pending}
      className="mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-smoke bg-cream hover:border-ink hover:bg-sand transition disabled:opacity-50"
      aria-label="Complete task"
    >
      {pending && <span className="text-[10px] text-smoke">…</span>}
    </button>
  );
}
