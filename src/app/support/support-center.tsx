"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

const articles = [
  { title: "Set up your semester", body: "Open Academics, add the active semester, then add or select the courses you are taking." },
  { title: "Build a study plan", body: "Use Planner after adding courses and timetable blocks. BRAIL uses your available times and course context to create sessions." },
  { title: "Ground AI answers in your notes", body: "Upload course material from a course workspace or attach it in AI Chat. Select the matching course before asking a question." },
  { title: "Recover from a failed upload", body: "Check the material status on the course page. Failed files show an error message and can be uploaded again after correcting the source file." },
  { title: "Manage notifications", body: "Use Notifications to mark items read, adjust reminder windows, and control which categories can create reminders." },
];

export function SupportCenter() {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return articles;
    return articles.filter((article) => `${article.title} ${article.body}`.toLowerCase().includes(normalized));
  }, [query]);

  return (
    <section aria-labelledby="help-articles-heading" className="rounded-2xl border border-border bg-white p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 id="help-articles-heading" className="text-lg font-semibold">Help articles</h2>
          <p className="mt-1 text-sm text-muted">Search practical answers for common BRAIL workflows.</p>
        </div>
      </div>
      <label className="relative mt-4 block">
        <span className="sr-only">Search help articles</span>
        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search help" className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm" />
      </label>
      <div className="mt-4 grid gap-3">
        {filtered.length ? filtered.map((article) => (
          <details key={article.title} className="rounded-md border border-border bg-surface p-4">
            <summary className="cursor-pointer font-semibold">{article.title}</summary>
            <p className="mt-2 text-sm leading-6 text-muted">{article.body}</p>
          </details>
        )) : <p className="rounded-md border border-border bg-surface p-4 text-sm text-muted">No matching help articles.</p>}
      </div>
    </section>
  );
}
