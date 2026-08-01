"use client";

import { BellOff, BellRing } from "lucide-react";
import { useEffect, useState } from "react";

const browserAlertsKey = "brail-browser-study-alerts";
type AlertStatus = "loading" | "unsupported" | "default" | "denied" | "enabled" | "disabled";

export function BrowserAlertSettings() {
  const [status, setStatus] = useState<AlertStatus>("loading");

  useEffect(() => {
    const timer = window.setTimeout(() => {
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
    if (permission === "granted") {
      localStorage.setItem(browserAlertsKey, "enabled");
      setStatus("enabled");
    } else {
      setStatus(permission === "denied" ? "denied" : "default");
    }
  }

  function disableAlerts() {
    localStorage.removeItem(browserAlertsKey);
    setStatus("disabled");
  }

  const unavailable = status === "unsupported" || status === "denied";
  const detail = status === "enabled"
    ? "Browser alerts are enabled on this device while BRAIL is open."
    : status === "denied"
      ? "Browser notifications are blocked. Allow them in this site's browser settings."
      : status === "unsupported"
        ? "This browser does not support desktop notifications."
        : "Enable a desktop alert in addition to the in-app reminder.";

  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-sm font-semibold">Browser alerts</p><p className="mt-1 text-xs leading-5 text-muted">{detail}</p></div>
        {status === "enabled" ? <BellRing className="h-5 w-5 shrink-0 text-accent" /> : <BellOff className="h-5 w-5 shrink-0 text-muted" />}
      </div>
      {!unavailable && status !== "loading" ? (
        <button type="button" onClick={status === "enabled" ? disableAlerts : enableAlerts} className="mt-3 h-9 rounded-md border border-border bg-background px-3 text-sm font-semibold text-foreground">
          {status === "enabled" ? "Turn off" : "Enable alerts"}
        </button>
      ) : null}
    </div>
  );
}