import { MessageSquareText, LifeBuoy } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import {
  updateFeedbackStatus,
  updateSupportRequestStatus,
} from "@/features/admin/actions";
import { requireAdmin } from "@/features/auth/queries";
import { prisma } from "@/server/db";

const supportStatuses = ["OPEN", "IN_PROGRESS", "RESOLVED"] as const;
const feedbackStatuses = ["NEW", "REVIEWED", "PLANNED", "CLOSED"] as const;

function statusLabel(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}

export default async function AdminFeedbackPage() {
  await requireAdmin();
  const [supportRequests, feedback] = await Promise.all([
    prisma.supportRequest.findMany({
      include: { user: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.feedback.findMany({
      include: { user: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return (
    <AppShell title="Support and feedback" eyebrow="Administration">
      <section className="rounded-2xl bg-[var(--accent-strong)] p-5 text-white">
        <MessageSquareText className="h-6 w-6" />
        <h2 className="mt-4 text-2xl font-semibold">Student voice</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
          Review support requests and product feedback, then keep each item’s status visible to the team.
        </p>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-border bg-white p-5">
          <div className="flex items-center gap-3">
            <LifeBuoy className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-semibold">Support requests ({supportRequests.length})</h2>
          </div>
          <div className="mt-5 grid gap-3">
            {supportRequests.map((request) => (
              <article key={request.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{request.subject}</h3>
                    <p className="mt-1 text-xs text-muted">{request.user.fullName} · {request.user.email}</p>
                  </div>
                  <span className="rounded-lg bg-surface px-2 py-1 text-xs font-semibold uppercase text-muted">{statusLabel(request.status)}</span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted">{request.message}</p>
                <form action={updateSupportRequestStatus} className="mt-4 flex gap-2">
                  <input type="hidden" name="id" value={request.id} />
                  <select name="status" defaultValue={request.status} className="h-9 flex-1 rounded-md border border-border bg-white px-2 text-xs">
                    {supportStatuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
                  </select>
                  <PendingSubmitButton className="h-9 rounded-md bg-foreground px-3 text-xs font-semibold text-background" pendingLabel="Saving...">Update</PendingSubmitButton>
                </form>
              </article>
            ))}
            {!supportRequests.length ? <p className="text-sm text-muted">No support requests yet.</p> : null}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-white p-5">
          <div className="flex items-center gap-3">
            <MessageSquareText className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-semibold">Product feedback ({feedback.length})</h2>
          </div>
          <div className="mt-5 grid gap-3">
            {feedback.map((item) => (
              <article key={item.id} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{statusLabel(item.type)}</h3>
                    <p className="mt-1 text-xs text-muted">{item.user.fullName} · {item.user.email}</p>
                  </div>
                  <span className="rounded-lg bg-surface px-2 py-1 text-xs font-semibold uppercase text-muted">{statusLabel(item.status)}</span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted">{item.message}</p>
                <form action={updateFeedbackStatus} className="mt-4 flex gap-2">
                  <input type="hidden" name="id" value={item.id} />
                  <select name="status" defaultValue={item.status} className="h-9 flex-1 rounded-md border border-border bg-white px-2 text-xs">
                    {feedbackStatuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
                  </select>
                  <PendingSubmitButton className="h-9 rounded-md bg-foreground px-3 text-xs font-semibold text-background" pendingLabel="Saving...">Update</PendingSubmitButton>
                </form>
              </article>
            ))}
            {!feedback.length ? <p className="text-sm text-muted">No feedback yet.</p> : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
