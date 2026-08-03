export function WorkspaceLoading() {
  return (
    <main className="min-h-screen bg-background text-foreground" aria-busy="true" aria-label="Loading page">
      <header className="sticky top-0 border-b border-border bg-white">
        <div className="mx-auto flex h-[4.875rem] w-full max-w-[90rem] items-center justify-between gap-5 px-5 sm:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 animate-pulse rounded-xl bg-[var(--accent-soft)]" />
            <div className="grid gap-2">
              <div className="h-3.5 w-28 animate-pulse rounded bg-border" />
              <div className="h-2.5 w-20 animate-pulse rounded bg-border" />
            </div>
          </div>
          <div className="hidden gap-2 lg:flex">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="h-9 w-20 animate-pulse rounded-lg bg-surface" />
            ))}
          </div>
          <div className="h-10 w-10 animate-pulse rounded-xl bg-surface" />
        </div>
      </header>

      <section className="mx-auto w-full max-w-[90rem] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        <div className="border-b border-border pb-6">
          <div className="h-3 w-24 animate-pulse rounded bg-[var(--accent-soft)]" />
          <div className="mt-3 h-10 w-72 max-w-full animate-pulse rounded-lg bg-border" />
        </div>
        <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-2xl border border-border bg-white" />
          ))}
        </div>
        <div className="mt-6 h-80 animate-pulse rounded-2xl border border-border bg-white" />
      </section>
    </main>
  );
}
