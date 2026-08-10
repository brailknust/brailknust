// Minimal service worker whose only job is Web Push delivery. It does not
// cache anything and does not intercept fetches — BRAIL isn't an offline-first
// app, this exists purely so push notifications can arrive while the tab is
// closed or the browser is backgrounded.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = { title: "BRAIL", body: "You have a new reminder.", openUrl: "/notifications" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // Malformed or missing payload — fall back to the generic reminder above
    // rather than dropping the notification silently.
  }

  const { title, body, openUrl, notificationId } = payload;
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag: notificationId ?? undefined,
      data: { openUrl: openUrl ?? "/notifications" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const openUrl = event.notification.data?.openUrl ?? "/notifications";

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = windows.find((client) => "focus" in client);
      if (existing) {
        await existing.focus();
        if ("navigate" in existing) await existing.navigate(openUrl);
        return;
      }
      await self.clients.openWindow(openUrl);
    })(),
  );
});
