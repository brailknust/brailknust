"use client";

import { FormEvent, useState } from "react";
import { FileUp, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";

export function PlatformUpload({
  course,
  topics,
}: {
  course: { id: string; code: string; name: string };
  topics: Array<{ id: string; title: string }>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    setError(false);
    try {
      const form = event.currentTarget;
      const response = await fetch("/api/admin/materials/upload", {
        method: "POST",
        body: new FormData(form),
      });
      const text = await response.text();
      const result = text ? JSON.parse(text) as { message?: string } : {};
      if (!response.ok) throw new Error(result.message ?? "Upload failed.");
      setMessage(result.message ?? "Platform material published.");
      form.reset();
      router.refresh();
    } catch (caught) {
      setError(true);
      setMessage(caught instanceof Error ? caught.message : "Upload failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-lg border border-border bg-background p-5">
      <input type="hidden" name="courseId" value={course.id} />
      <div>
        <h2 className="text-lg font-semibold">Add material to the course outline</h2>
        <p className="mt-1 text-sm text-muted">{course.code} - {course.name}</p>
      </div>
      <label className="grid gap-2 text-sm font-semibold">
        Outline topics
      <select name="topicIds" required multiple size={Math.min(Math.max(topics.length, 2), 6)} className="min-h-20 rounded-md border border-border bg-background px-3 py-2 text-sm font-normal">
        {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}
      </select>
      <span className="text-xs font-normal text-muted">Select one or several topics. Use “General resources” for course-wide material.</span>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="title" required maxLength={160} placeholder="Material title" className="h-11 rounded-md border border-border bg-background px-3 text-sm" />
        <select name="type" defaultValue="SLIDE" className="h-11 rounded-md border border-border bg-background px-3 text-sm">
          <option value="SLIDE">Slides</option>
          <option value="NOTE">Notes</option>
          <option value="PAST_QUESTION">Past question</option>
          <option value="OTHER">Other</option>
        </select>
      </div>
      <input name="sourceUrl" type="url" placeholder="Source or rights URL (optional)" className="h-11 rounded-md border border-border bg-background px-3 text-sm" />
      <input name="file" type="file" required accept=".pdf,.docx,.pptx,.txt,.md,.png,.jpg,.jpeg,.webp" className="min-h-11 rounded-md border border-border bg-surface px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-foreground file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-background" />
      <p className="text-xs leading-5 text-muted">Files may be up to 50MB. Published immediately for every student enrolled in this course. Upload only material the platform has permission to use.</p>
      {message ? <p className={`text-sm font-medium ${error ? "text-red-600" : "text-accent"}`}>{message}</p> : null}
      <button disabled={pending || topics.length === 0} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-60">
        {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
        {pending ? "Processing..." : topics.length ? "Upload and publish" : "Add a topic first"}
      </button>
    </form>
  );
}
