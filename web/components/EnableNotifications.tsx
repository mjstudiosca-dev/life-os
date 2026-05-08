"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const arr = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) arr[i] = rawData.charCodeAt(i);
  return buffer;
}

export function EnableNotifications() {
  const [status, setStatus] = useState<"unsupported" | "denied" | "granted" | "default" | "subscribed" | "checking">("checking");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }

    (async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        setStatus("subscribed");
        return;
      }
      setStatus(Notification.permission as "denied" | "granted" | "default");
    })();
  }, []);

  async function enable() {
    setError(null);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setStatus(perm as "denied" | "default");
        return;
      }
      const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapid) {
        setError("VAPID public key not configured.");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Failed to register subscription.");
        return;
      }
      setStatus("subscribed");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  if (status === "checking" || status === "subscribed") return null;
  if (status === "unsupported") {
    return (
      <p className="text-xs text-zinc-500 mt-4">
        Push notifications aren't supported in this browser. Use Safari on iOS
        16.4+ (after installing the PWA) or any modern desktop browser.
      </p>
    );
  }

  return (
    <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-sm">
      <p className="mb-2 text-zinc-200">Get a daily 6 AM brief notification on this device.</p>
      <button
        onClick={enable}
        disabled={status === "denied"}
        className="rounded-lg bg-zinc-100 text-zinc-900 px-3 py-1.5 font-medium hover:bg-white disabled:opacity-50"
      >
        {status === "denied" ? "Notifications blocked" : "Enable notifications"}
      </button>
      {error && <p className="mt-2 text-red-400">{error}</p>}
    </div>
  );
}
