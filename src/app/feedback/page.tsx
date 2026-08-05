import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { submitFeedback } from "@/features/feedback/actions";

type FeedbackPageProps = { searchParams: Promise<{ submitted?: string }> };

export default async function FeedbackPage({ searchParams }: FeedbackPageProps) {
  const { submitted } = await searchParams;

  return (
    <AppShell title="Feedback" eyebrow="Product">
      <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <section className="rounded-2xl border border-border bg-white p-5">
          <h2 className="text-lg font-semibold">Help shape BRAIL</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Tell us what is useful, confusing, missing, or broken. Feedback is saved for product review.</p>
          {submitted === "1" ? <p role="status" className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">Thanks. Your feedback was submitted for review.</p> : null}
          <form action={submitFeedback} className="mt-5 grid gap-4">
            <label className="grid gap-2 text-sm font-semibold">Feedback type<select name="type" defaultValue="IDEA" className="h-11 rounded-md border border-border bg-background px-3 text-sm font-normal"><option value="BUG">Something is broken</option><option value="IDEA">Feature idea</option><option value="PRAISE">What is working well</option><option value="OTHER">Other</option></select></label>
            <label className="grid gap-2 text-sm font-semibold">Your feedback<textarea name="message" required minLength={10} maxLength={5000} className="min-h-40 rounded-md border border-border bg-background px-3 py-3 text-sm font-normal" /></label>
            <PendingSubmitButton pendingLabel="Submitting..." className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white">Submit feedback</PendingSubmitButton>
          </form>
          <Link href="/support" className="mt-5 inline-flex text-sm font-semibold text-accent hover:underline">Open support and help</Link>
        </section>
        <aside className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-lg font-semibold">What makes feedback useful?</h2>
          <ul className="mt-4 grid gap-3 text-sm leading-6 text-muted"><li>Describe what you expected to happen.</li><li>Include the route or workflow where it happened.</li><li>Leave out passwords, tokens, and private academic records.</li></ul>
        </aside>
      </div>
    </AppShell>
  );
}
