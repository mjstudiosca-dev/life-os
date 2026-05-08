"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    const supabase = createClient();
    const { error: supabaseError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    if (supabaseError) {
      setError(supabaseError.message);
      setStatus("error");
      return;
    }
    setStatus("sent");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-light mb-1">Life OS</h1>
        <p className="text-zinc-400 text-sm mb-8">Your morning, your day.</p>

        {status === "sent" ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm">
            <p className="font-medium mb-1">Check your email.</p>
            <p className="text-zinc-400">
              We sent a magic link to <span className="text-zinc-200">{email}</span>.
              Click it to sign in.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-600 focus:outline-none"
            />
            <button
              type="submit"
              disabled={status === "sending"}
              className="w-full rounded-lg bg-zinc-100 text-zinc-900 px-4 py-3 font-medium hover:bg-white disabled:opacity-50 transition"
            >
              {status === "sending" ? "Sending…" : "Send magic link"}
            </button>
            {error && (
              <p className="text-sm text-red-400 mt-2">{error}</p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
