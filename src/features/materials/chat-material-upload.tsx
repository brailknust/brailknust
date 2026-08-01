"use client";

import { FormEvent, useRef, useState } from "react";
import { FileUp, LoaderCircle, LockKeyhole, Paperclip, X } from "lucide-react";
import { useRouter } from "next/navigation";

type ChatMaterialUploadProps = {
  enrollmentId: string;
  semesterId: string;
  courseId: string;
  courseLabel: string;
  topics: Array<{ id: string; title: string }>;
};

export function ChatMaterialUpload({
  enrollmentId,
  semesterId,
  courseId,
  courseLabel,
  topics,
}: ChatMaterialUploadProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setMessage("");
    setIsError(false);

    try {
      const response = await fetch("/api/materials/upload", {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      const text = await response.text();
      let result: { message?: string } = {};
      try {
        result = text ? JSON.parse(text) as { message?: string } : {};
      } catch {
        result.message = response.ok ? "Material uploaded." : `Upload failed (${response.status}).`;
      }
      if (!response.ok) throw new Error(result.message ?? "Could not upload this file.");
      setMessage("File processed. BRAIL can now use it in this course chat.");
      formRef.current?.reset();
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Could not upload this file.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-8 items-center gap-2 rounded-md px-2 text-xs font-semibold text-muted transition-colors hover:bg-background hover:text-foreground"
        >
          <Paperclip className="h-3.5 w-3.5" /> Attach material
        </button>
      ) : (
        <form ref={formRef} onSubmit={upload} className="mb-3 grid gap-3 rounded-xl border border-border bg-background p-4 shadow-sm">
          <input type="hidden" name="enrollmentId" value={enrollmentId} />
          <input type="hidden" name="semesterId" value={semesterId} />
          <input type="hidden" name="courseId" value={courseId} />
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Add material to {courseLabel}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                <LockKeyhole className="h-3 w-3" /> Private to you and scoped to this course
              </p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close upload" className="grid h-8 w-8 shrink-0 place-items-center rounded-md hover:bg-background">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <input name="title" required maxLength={160} placeholder="Material title" className="h-10 rounded-md border border-border bg-background px-3 text-sm" />
            <select name="type" defaultValue="NOTE" className="h-10 rounded-md border border-border bg-background px-3 text-sm">
              <option value="NOTE">Lecture note</option>
              <option value="SLIDE">Slides</option>
              <option value="PAST_QUESTION">Past question</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <input name="topic" maxLength={120} list="chat-upload-topic-options" placeholder="Topic (optional, e.g. Power cables)" className="h-10 rounded-md border border-border bg-background px-3 text-sm" />
          <datalist id="chat-upload-topic-options">
            {topics.map((topic) => <option key={topic.id} value={topic.title} />)}
          </datalist>
          <label className="grid gap-1.5 text-xs font-semibold">
            Choose file
            <input name="file" type="file" required accept=".pdf,.docx,.pptx,.txt,.md,.png,.jpg,.jpeg,.webp" className="min-h-10 rounded-md border border-dashed border-border bg-surface px-3 py-2 text-xs font-normal file:mr-3 file:rounded-md file:border-0 file:bg-foreground file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-background" />
          </label>
          <p className="-mt-1 text-[11px] text-muted">PDF, Word, PowerPoint, text, or image · documents up to 50MB</p>
          {message ? <p aria-live="polite" className={`text-xs font-medium ${isError ? "text-red-600" : "text-accent"}`}>{message}</p> : null}
          <button disabled={pending} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-xs font-semibold text-background disabled:opacity-60">
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
            {pending ? "Extracting and indexing..." : "Upload for this chat"}
          </button>
        </form>
      )}
    </div>
  );
}
