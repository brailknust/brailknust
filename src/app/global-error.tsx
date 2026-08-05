"use client";

export default function GlobalError({ unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#f6f9f7] text-[#13251a]">
        <main className="grid min-h-screen place-items-center px-5 py-12">
          <section className="w-full max-w-lg rounded-2xl border border-[#dce8df] bg-white p-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#08783f]">BRAIL KNUST</p>
            <h1 className="mt-3 text-2xl font-semibold">BRAIL needs to restart this page</h1>
            <p className="mt-3 text-sm leading-6 text-[#627269]">A serious page error occurred. Try again to recover your workspace.</p>
            <button onClick={() => unstable_retry()} className="mt-6 h-11 rounded-md bg-[#045c2e] px-4 text-sm font-semibold text-white">Try again</button>
          </section>
        </main>
      </body>
    </html>
  );
}
