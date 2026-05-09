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
  const [status, setStatus] = useState<
    "unsupported" | "denied" | "granted" | "default" | "subscribed" | "checking"
  >("checking");
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
      <p className="mt-8 text-xs text-smoke italic">
        Push notifications aren't supported in this browser. Use Safari on iOS
        16.4+ (after installing the PWA) or any modern desktop browser.
      </p>
    );
  }

  return (
    <div className="mt-10 rounded-xl border border-bone bg-sand/40 p-5">
      <p className="font-serif text-lg text-oxblood mb-1">
        Wake up to your brief.
      </p>
      <p className="text-sm text-smoke mb-4">
        Get a 6 AM notification on this device.
      </p>
      <button
        onClick={enable}
        disabled={status === "denied"}
        className="rounded-lg bg-plum text-cream px-4 py-2 font-medium hover:bg-oxblood disabled:opacity-50 transition"
      >
        {status === "denied" ? "Notifications blocked" : "Enable notifications"}
      </button>
      {error && <p className="mt-3 text-sm text-rust">{error}</p>}
    </div>
  );
}
