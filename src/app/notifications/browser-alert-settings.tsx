"use client";

import { BellOff, BellRing } from "lucide-react";
import { useEffect, useState } from "react";

const browserAlertsKey = "brail-browser-study-alerts";
type AlertStatus = "loading" | "unsupported" | "default" | "denied" | "enabled" | "disabled";

// Web Push wants the VAPID public key as a Uint8Array, not the base64url string
// the server hands out — https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe
function urlBase64ToUint8Array(base64Url: string) {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

async function subscribeToPush() {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey || !("serviceWorker" in navigator) || !("PushManager" in window)) return;

  const registration = await navigator.serviceWorker.register("/sw.js");
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    }));

  await fetch("/api/notifications/push-subscription", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });
}

async function unsubscribeFromPush() {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  await fetch("/api/notifications/push-subscription", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });
  await subscription.unsubscribe();
}

export function BrowserAlertSettings() {
  const [status, setStatus] = useState<AlertStatus>("loading");
  // Starts false to match the server-rendered markup, then updated on mount —
  // `typeof window` differs between SSR and the client's first paint, so this
  // can't be computed directly in the render body without a hydration mismatch.
  const [pushSupported, setPushSupported] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPushSupported("serviceWorker" in navigator && "PushManager" in window);

      if (!("Notification" in window)) {
        setStatus("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }
      const enabled = localStorage.getItem(browserAlertsKey) === "enabled";
      setStatus(Notification.permission === "granted" && enabled ? "enabled" : "disabled");
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  async function enableAlerts() {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setStatus(permission === "denied" ? "denied" : "default");
      return;
    }
    localStorage.setItem(browserAlertsKey, "enabled");
    setStatus("enabled");
    // Best-effort: the in-tab reminder above already works without push, so a
    // failure here (e.g. an unsupported browser, or the subscribe request
    // failing) shouldn't block the toggle from turning on.
    try {
      await subscribeToPush();
    } catch {
      // Falls back to in-tab-only alerts, handled by notification-poller.tsx.
    }
  }

  async function disableAlerts() {
    localStorage.removeItem(browserAlertsKey);
    setStatus("disabled");
    try {
      await unsubscribeFromPush();
    } catch {
      // The subscription may already be gone server-side; nothing to recover.
    }
  }

  const unavailable = status === "unsupported" || status === "denied";
  const detail = status === "enabled"
    ? pushSupported
      ? "Alerts are enabled on this device, including when BRAIL is closed or in the background."
      : "Browser alerts are enabled on this device while BRAIL is open. This browser doesn't support background push."
    : status === "denied"
      ? "Browser notifications are blocked. Allow them in this site's browser settings."
      : status === "unsupported"
        ? "This browser does not support desktop notifications."
        : pushSupported
          ? "Enable alerts that arrive even when BRAIL isn't open."
          : "Enable a desktop alert in addition to the in-app reminder.";

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-sm font-semibold">Browser alerts</p><p className="mt-1 text-xs leading-5 text-muted">{detail}</p></div>
        {status === "enabled" ? <BellRing className="h-5 w-5 shrink-0 text-accent" /> : <BellOff className="h-5 w-5 shrink-0 text-muted" />}
      </div>
      {!unavailable && status !== "loading" ? (
        <button type="button" onClick={status === "enabled" ? disableAlerts : enableAlerts} className="mt-3 h-9 rounded-xl border border-border bg-white px-3 text-sm font-semibold text-foreground">
          {status === "enabled" ? "Turn off" : "Enable alerts"}
        </button>
      ) : null}
    </div>
  );
}
