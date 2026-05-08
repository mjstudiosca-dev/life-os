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
      className="mr-2 inline-flex h-4 w-4 items-center justify-center rounded border border-zinc-600 hover:border-zinc-300 disabled:opacity-50"
      aria-label="Complete task"
    >
      {pending && <span className="text-[10px] text-zinc-400">…</span>}
    </button>
  );
}
