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
  conversationId?: string | null;
  onUploaded?: (attachment: { id: string; title: string; fileName: string; fileSize: number }) => void;
};

export function titleFromFileName(fileName: string) {
  const withoutExtension = fileName.replace(/\.[^./\\]+$/, "");
  const cleaned = withoutExtension.replace(/[_-]+/g, " ").trim();
  return (cleaned || "Untitled material").slice(0, 160);
}

export function ChatMaterialUpload({
  enrollmentId,
  semesterId,
  courseId,
  courseLabel,
  conversationId,
  onUploaded,
}: ChatMaterialUploadProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  function handleFileChange(event: FormEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (file && titleInputRef.current) {
      titleInputRef.current.value = titleFromFileName(file.name);
    }
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setMessage("");
    setIsError(false);

    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    const title = titleInputRef.current?.value || "Untitled material";

    try {
      const response = await fetch("/api/materials/upload", {
        method: "POST",
        body: form,
      });
      const text = await response.text();
      let result: { message?: string; attachmentMessageId?: string | null } = {};
      try {
        result = text ? JSON.parse(text) as { message?: string; attachmentMessageId?: string | null } : {};
      } catch {
        result.message = response.ok ? "Material uploaded." : `Upload failed (${response.status}).`;
      }
      if (!response.ok) throw new Error(result.message ?? "Could not upload this file.");
      setMessage("File processed. BRAIL can now use it in this course chat.");
      if (result.attachmentMessageId && file instanceof File) {
        onUploaded?.({ id: result.attachmentMessageId, title, fileName: file.name, fileSize: file.size });
      }
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
        <form ref={formRef} onSubmit={upload} className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background p-2.5 shadow-sm">
          <input type="hidden" name="enrollmentId" value={enrollmentId} />
          <input type="hidden" name="semesterId" value={semesterId} />
          <input type="hidden" name="courseId" value={courseId} />
          {conversationId ? <input type="hidden" name="conversationId" value={conversationId} /> : null}
          <input ref={titleInputRef} type="hidden" name="title" />
          <input type="hidden" name="type" value="OTHER" />
          <span className="hidden items-center gap-1.5 text-xs text-muted sm:flex" title={`Private to you, scoped to ${courseLabel}`}>
            <LockKeyhole className="h-3 w-3" />
          </span>
          <input
            name="file"
            type="file"
            required
            aria-label="Choose file"
            onChange={handleFileChange}
            accept=".pdf,.docx,.pptx,.txt,.md,.png,.jpg,.jpeg,.webp"
            className="min-w-0 flex-1 rounded-md border border-dashed border-border bg-surface px-2 py-1.5 text-xs file:mr-2 file:rounded-md file:border-0 file:bg-foreground file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-background"
          />
          <button disabled={pending} className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md bg-foreground px-3 text-xs font-semibold text-background disabled:opacity-60">
            {pending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
            {pending ? "Uploading..." : "Upload"}
          </button>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close upload" className="grid h-8 w-8 shrink-0 place-items-center rounded-md hover:bg-background">
            <X className="h-4 w-4" />
          </button>
          {message ? <p aria-live="polite" className={`w-full text-xs font-medium ${isError ? "text-red-600" : "text-accent"}`}>{message}</p> : null}
        </form>
      )}
    </div>
  );
}
