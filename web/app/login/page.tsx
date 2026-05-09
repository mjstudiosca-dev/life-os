"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  async function signInWithGoogle() {
    setError(null);
    setStatus("sending");
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/api/auth/callback` },
    });
    if (err) {
      setError(err.message);
      setStatus("error");
    }
  }

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
    <main className="flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <p className="text-[11px] uppercase tracking-[0.22em] text-ash mb-3">
          Welcome back
        </p>
        <h1 className="font-serif text-5xl text-oxblood leading-tight">
          Life OS
        </h1>
        <p className="mt-3 text-smoke italic font-serif text-lg mb-10">
          Your morning, your day.
        </p>

        {status === "sent" ? (
          <div className="rounded-xl border border-bone bg-sand/50 p-5">
            <p className="font-serif text-lg text-oxblood mb-1">
              Check your email.
            </p>
            <p className="text-sm text-smoke">
              A sign-in link is on its way to{" "}
              <span className="text-ink">{email}</span>.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={status === "sending"}
              className="w-full flex items-center justify-center gap-3 rounded-lg bg-plum text-cream px-4 py-3 font-medium hover:bg-oxblood disabled:opacity-50 transition"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#fff" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                <path fill="#f5efe6" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                <path fill="#ebe2d3" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
                <path fill="#d4c5b1" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58z"/>
              </svg>
              {status === "sending" ? "Redirecting…" : "Sign in with Google"}
            </button>

            <div className="flex items-center gap-3 text-xs text-ash">
              <div className="flex-1 border-t border-bone" />
              <span className="font-serif italic">or</span>
              <div className="flex-1 border-t border-bone" />
            </div>

            <form onSubmit={onSubmit} className="space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-bone bg-cream px-4 py-3 text-ink placeholder:text-ash focus:border-smoke focus:outline-none"
              />
              <button
                type="submit"
                disabled={status === "sending"}
                className="w-full rounded-lg border border-bone bg-sand/50 text-ink px-4 py-3 font-medium hover:border-smoke disabled:opacity-50 transition"
              >
                {status === "sending" ? "Sending…" : "Email me a magic link"}
              </button>
            </form>

            {error && <p className="text-sm text-rust">{error}</p>}
          </div>
        )}
      </div>
    </main>
  );
}
