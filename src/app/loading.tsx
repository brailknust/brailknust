export default function AppLoading() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-6 px-6 py-5 sm:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 animate-pulse rounded-lg bg-border" />
            <div className="grid gap-2">
              <div className="h-4 w-28 animate-pulse rounded bg-border" />
              <div className="h-3 w-20 animate-pulse rounded bg-border" />
            </div>
          </div>
          <div className="h-10 w-24 animate-pulse rounded-md bg-border" />
        </div>
      </header>
      <section className="mx-auto w-full max-w-7xl px-6 py-10 sm:px-8 lg:px-10">
        <div className="h-4 w-24 animate-pulse rounded bg-border" />
        <div className="mt-3 h-9 w-64 max-w-full animate-pulse rounded bg-border" />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="h-36 animate-pulse rounded-lg border border-border bg-surface" />
          ))}
        </div>
        <div className="mt-6 h-72 animate-pulse rounded-lg border border-border bg-surface" />
      </section>
    </main>
  );
}
