"use client";

import { FormEvent, useState } from "react";
import { FileUp, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";

type MaterialUploadProps = {
  enrollmentId: string;
  semesterId: string;
  courseId: string;
  topics: Array<{ id: string; title: string }>;
};

export function MaterialUpload({
  enrollmentId,
  semesterId,
  courseId,
  topics,
}: MaterialUploadProps) {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isUploading) return;

    setIsUploading(true);
    setMessage("");
    setIsError(false);

    try {
      const form = event.currentTarget;
      const response = await fetch("/api/materials/upload", {
        method: "POST",
        body: new FormData(form),
      });
      const responseText = await response.text();
      let result: { message?: string } = {};
      if (responseText) {
        try {
          result = JSON.parse(responseText) as { message?: string };
        } catch {
          result = {
            message: response.ok
              ? "Material uploaded."
              : `The upload server returned an invalid response (${response.status}).`,
          };
        }
      }
      if (!response.ok) throw new Error(result.message ?? "Could not upload this material.");

      setMessage(result.message ?? "Material uploaded.");
      form.reset();
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Could not upload this material.");
      router.refresh();
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form onSubmit={upload} className="mt-5 grid gap-3 rounded-md border border-border bg-surface p-4">
      <input type="hidden" name="enrollmentId" value={enrollmentId} />
      <input type="hidden" name="semesterId" value={semesterId} />
      <input type="hidden" name="courseId" value={courseId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          name="title"
          required
          maxLength={160}
          placeholder="Material title"
          className="h-11 rounded-md border border-border bg-background px-3 text-sm"
        />
        <select
          name="type"
          defaultValue="NOTE"
          className="h-11 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="NOTE">Lecture note</option>
          <option value="SLIDE">Slides</option>
          <option value="PAST_QUESTION">Past question</option>
          <option value="OTHER">Other</option>
        </select>
      </div>
      <input
        name="topic"
        maxLength={120}
        list="upload-course-topic-options"
        placeholder="Topic (optional)"
        className="h-11 rounded-md border border-border bg-background px-3 text-sm"
      />
      <datalist id="upload-course-topic-options">
        {topics.map((topic) => <option key={topic.id} value={topic.title} />)}
      </datalist>
      <label className="grid gap-2 text-sm font-semibold">
        Material file
        <input
          name="file"
          type="file"
          required
          accept=".pdf,.docx,.pptx,.txt,.md,.png,.jpg,.jpeg,.webp"
          className="min-h-11 rounded-md border border-border bg-background px-3 py-2 text-sm font-normal file:mr-3 file:rounded-md file:border-0 file:bg-foreground file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-background"
        />
      </label>
      <p className="text-xs leading-5 text-muted">
        PDF, Word, PowerPoint, text, or image. Documents may be up to 50MB; OCR images up to 6MB.
      </p>
      {message ? (
        <p className={`text-sm font-medium ${isError ? "text-red-600" : "text-accent"}`} aria-live="polite">
          {message}
        </p>
      ) : null}
      <button
        disabled={isUploading}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-60"
      >
        {isUploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
        {isUploading ? "Extracting and indexing..." : "Upload and process"}
      </button>
    </form>
  );
}
