import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { SupportCenter } from "@/app/support/support-center";
import { submitSupportRequest } from "@/features/support/actions";

type SupportPageProps = { searchParams: Promise<{ submitted?: string }> };

export default async function SupportPage({ searchParams }: SupportPageProps) {
  const { submitted } = await searchParams;

  return (
    <AppShell title="Support" eyebrow="Help">
      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <SupportCenter />
        <section aria-labelledby="support-request-heading" className="rounded-2xl border border-border bg-white p-5">
          <h2 id="support-request-heading" className="text-lg font-semibold">Contact support</h2>
          <p className="mt-1 text-sm leading-6 text-muted">Send a tracked request when the help articles do not answer your question.</p>
          {submitted === "1" ? <p role="status" className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">Your request was received. We will review it from the support queue.</p> : null}
          <form action={submitSupportRequest} className="mt-5 grid gap-4">
            <label className="grid gap-2 text-sm font-semibold">Subject<input name="subject" required minLength={3} maxLength={160} className="h-11 rounded-md border border-border bg-background px-3 text-sm font-normal" /></label>
            <label className="grid gap-2 text-sm font-semibold">What do you need help with?<textarea name="message" required minLength={10} maxLength={5000} className="min-h-32 rounded-md border border-border bg-background px-3 py-3 text-sm font-normal" /></label>
            <PendingSubmitButton pendingLabel="Sending..." className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white">Send support request</PendingSubmitButton>
          </form>
          <p className="mt-4 text-xs leading-5 text-muted">For account or data requests, include only the details needed to identify the issue. Never include passwords or secret keys.</p>
          <Link href="/feedback" className="mt-5 inline-flex text-sm font-semibold text-accent hover:underline">Send product feedback</Link>
        </section>
      </div>
    </AppShell>
  );
}
