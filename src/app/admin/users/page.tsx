import { RefreshCw, ShieldCheck, ShieldMinus, ShieldPlus } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { PendingSubmitButton } from "@/components/pending-submit-button";
import { grantAdminRole, retryAccountDeletionCleanup, revokeAdminRole } from "@/features/admin/actions";
import { requireAdmin } from "@/features/auth/queries";
import { prisma } from "@/server/db";

export default async function AdminUsersPage() {
  const { appUser } = await requireAdmin();
  const [users, audits, adminCount, pendingDeletionCleanups] = await Promise.all([
    prisma.user.findMany({
      where: { deletedAt: null },
      select: { id: true, fullName: true, email: true, role: true, createdAt: true },
      orderBy: [{ role: "asc" }, { fullName: "asc" }],
    }),
    prisma.adminRoleAudit.findMany({
      include: {
        actor: { select: { fullName: true, email: true } },
        targetUser: { select: { fullName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.user.count({ where: { role: "ADMIN", deletedAt: null } }),
    prisma.user.findMany({
      where: {
        deletedAt: { not: null },
        OR: [{ deletionStoragePending: true }, { deletionAuthPending: true }],
      },
      select: {
        id: true,
        deletedAt: true,
        deletionStoragePending: true,
        deletionAuthPending: true,
        deletionAttempts: true,
      },
      orderBy: { deletedAt: "asc" },
    }),
  ]);

  return (
    <AppShell title="Administrator access" eyebrow="Administration">
      <section className="rounded-2xl bg-[var(--accent-strong)] p-5 text-white">
        <ShieldCheck className="h-6 w-6" />
        <h2 className="mt-4 text-2xl font-semibold">Audited access control</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
          Administrator changes are permanent audit events. The final administrator cannot be removed.
        </p>
      </section>

      {pendingDeletionCleanups.length ? (
        <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-lg font-semibold">Account cleanup requiring retry</h2>
          <div className="mt-4 grid gap-3">
            {pendingDeletionCleanups.map((cleanup) => (
              <div key={cleanup.id} className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold">Deleted account</p>
                  <p className="mt-1 text-xs text-muted">
                    Pending: {cleanup.deletionStoragePending ? "private files" : ""}
                    {cleanup.deletionStoragePending && cleanup.deletionAuthPending ? " and " : ""}
                    {cleanup.deletionAuthPending ? "login revocation" : ""} · Attempts: {cleanup.deletionAttempts}
                  </p>
                </div>
                <form action={retryAccountDeletionCleanup}>
                  <input type="hidden" name="userId" value={cleanup.id} />
                  <PendingSubmitButton pendingLabel="Retrying..." className="inline-flex h-10 items-center gap-2 rounded-xl bg-amber-700 px-3 text-sm font-semibold text-white">
                    <RefreshCw className="h-4 w-4" />
                    Retry cleanup
                  </PendingSubmitButton>
                </form>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-6 rounded-2xl border border-border bg-white p-5">
        <h2 className="text-lg font-semibold">Users</h2>
        <div className="mt-4 grid gap-3">
          {users.map((user) => {
            const isFinalAdmin = user.role === "ADMIN" && adminCount === 1;
            return (
              <div key={user.id} className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold">{user.fullName}</p>
                  <p className="mt-1 text-xs text-muted">{user.email} · {user.role === "ADMIN" ? "Administrator" : "Student"}</p>
                </div>
                {user.role === "ADMIN" ? (
                  <form action={revokeAdminRole}>
                    <input type="hidden" name="userId" value={user.id} />
                    <ConfirmSubmitButton
                      message="Remove administrator access from this user?"
                      titleText="Remove administrator"
                      confirmLabel="Remove access"
                      disabled={isFinalAdmin}
                      className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-200 px-3 text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ShieldMinus className="h-4 w-4" />
                      {user.id === appUser.id ? "Remove my access" : "Remove admin"}
                    </ConfirmSubmitButton>
                  </form>
                ) : (
                  <form action={grantAdminRole}>
                    <input type="hidden" name="userId" value={user.id} />
                    <ConfirmSubmitButton
                      message="Grant full administrator access to this user?"
                      titleText="Grant administrator"
                      confirmLabel="Grant access"
                      className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--accent-strong)] px-3 text-sm font-semibold text-white"
                    >
                      <ShieldPlus className="h-4 w-4" />
                      Grant admin
                    </ConfirmSubmitButton>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-white p-5">
        <h2 className="text-lg font-semibold">Recent access history</h2>
        <div className="mt-4 grid gap-3">
          {audits.map((audit) => (
            <div key={audit.id} className="rounded-xl border border-border bg-surface p-3 text-sm">
              <p className="font-medium">{audit.action.toLowerCase()} · {audit.targetUser.fullName}</p>
              <p className="mt-1 text-xs text-muted">
                {audit.actor ? `By ${audit.actor.fullName}` : "Initial environment bootstrap"} · {audit.createdAt.toLocaleString("en-GH")}
              </p>
            </div>
          ))}
          {!audits.length ? <p className="text-sm text-muted">No administrator changes have been recorded yet.</p> : null}
        </div>
      </section>
    </AppShell>
  );
}
