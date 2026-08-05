"use client";

import { useEffect } from "react";

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("BRAIL route error", { name: error.name, digest: error.digest });
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-background px-5 py-12 text-foreground">
      <section className="w-full max-w-lg rounded-2xl border border-border bg-white p-6 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">BRAIL KNUST</p>
        <h1 className="mt-3 text-2xl font-semibold">This page could not load</h1>
        <p className="mt-3 text-sm leading-6 text-muted">The problem may be temporary. Try the page again, or return to your dashboard.</p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <button onClick={() => retry()} className="h-11 rounded-md bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white">Try again</button>
          <a href="/dashboard" className="inline-flex h-11 items-center justify-center rounded-md border border-border px-4 text-sm font-semibold">Dashboard</a>
        </div>
      </section>
    </main>
  );
}
