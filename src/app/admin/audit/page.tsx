import Link from "next/link";
import { ScrollText } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { requireAdmin } from "@/features/auth/queries";
import { prisma } from "@/server/db";

type AuditPageProps = { searchParams: Promise<{ target?: string; page?: string }> };
const targets = new Set(["CATALOG", "TOPIC", "MATERIAL"]);
const pageSize = 30;

function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase();
}

export default async function AdminAuditPage({ searchParams }: AuditPageProps) {
  await requireAdmin();
  const query = await searchParams;
  const target = targets.has(query.target ?? "") ? query.target as "CATALOG" | "TOPIC" | "MATERIAL" : undefined;
  const requestedPage = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
  const where = target ? { targetType: target } : {};
  const total = await prisma.adminContentAudit.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, pageCount);
  const records = await prisma.adminContentAudit.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  const href = (nextPage: number) => `/admin/audit?${new URLSearchParams({ ...(target ? { target } : {}), page: String(nextPage) })}`;

  return (
    <AppShell title="Content audit history" eyebrow="Administration">
      <section className="rounded-2xl bg-[var(--accent-strong)] p-5 text-white">
        <ScrollText className="h-6 w-6" />
        <h2 className="mt-4 text-2xl font-semibold">Immutable administrator history</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">Catalog, topic, and platform-material mutations are recorded with their actor, target, time, and privacy-minimized operational metadata.</p>
      </section>

      <form method="get" className="mt-6 flex flex-col gap-3 rounded-2xl border border-border bg-white p-4 sm:flex-row">
        <select name="target" defaultValue={target ?? ""} className="h-10 flex-1 rounded-lg border border-border bg-white px-3 text-sm">
          <option value="">All target types</option><option value="CATALOG">Catalog</option><option value="TOPIC">Topics</option><option value="MATERIAL">Materials</option>
        </select>
        <button className="h-10 rounded-lg bg-foreground px-4 text-sm font-semibold text-background">Filter history</button>
      </form>

      <section className="mt-6 rounded-2xl border border-border bg-white p-5">
        <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Recorded changes</h2><p className="text-sm text-muted">{total} events</p></div>
        <div className="mt-4 grid gap-3">
          {records.map((record) => <article key={record.id} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="font-semibold">{label(record.action)}</p><p className="mt-1 text-sm text-muted">{record.targetLabel ?? record.targetId} · {label(record.targetType)}</p></div>
              <p className="text-xs text-muted">{record.createdAt.toLocaleString("en-GH")}</p>
            </div>
            <p className="mt-3 text-xs text-muted">Actor ID: {record.actorId}</p>
            {Object.keys(record.metadata as object).length ? <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-white p-3 text-xs text-muted">{JSON.stringify(record.metadata, null, 2)}</pre> : null}
          </article>)}
          {!records.length ? <p className="text-sm text-muted">No audit events match this filter.</p> : null}
        </div>
        {pageCount > 1 ? <nav aria-label="Audit pages" className="mt-5 flex justify-between">
          {page > 1 ? <Link href={href(page - 1)} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold">Previous</Link> : <span />}
          <span className="self-center text-xs text-muted">Page {page} of {pageCount}</span>
          {page < pageCount ? <Link href={href(page + 1)} className="rounded-lg border border-border px-3 py-2 text-sm font-semibold">Next</Link> : <span />}
        </nav> : null}
      </section>
    </AppShell>
  );
}
