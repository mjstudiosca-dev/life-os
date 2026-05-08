// Life OS service worker — handles incoming push notifications and
// notification clicks.

self.addEventListener("push", (event) => {
  let payload = { title: "Life OS", body: "Your morning brief is ready.", url: "/today" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch (e) {
    // payload stays as default
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "life-os-morning",
      data: { url: payload.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/today";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      // Focus an existing tab if one's already open at the URL.
      for (const w of wins) {
        if (w.url.endsWith(url) && "focus" in w) return w.focus();
      }
      return clients.openWindow(url);
    }),
  );
});
