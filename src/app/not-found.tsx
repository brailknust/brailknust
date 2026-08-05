import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-5 py-12 text-foreground">
      <section className="w-full max-w-lg rounded-2xl border border-border bg-white p-6 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">BRAIL KNUST</p>
        <h1 className="mt-3 text-2xl font-semibold">We could not find that page</h1>
        <p className="mt-3 text-sm leading-6 text-muted">The link may be outdated or the item may no longer be available.</p>
        <Link href="/dashboard" className="mt-6 inline-flex h-11 items-center justify-center rounded-md bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white">Return to dashboard</Link>
      </section>
    </main>
  );
}
