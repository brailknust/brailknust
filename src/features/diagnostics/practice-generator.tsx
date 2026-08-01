"use client";

import { FormEvent, useMemo, useState } from "react";
import { LoaderCircle, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

type EnrollmentOption = {
  id: string;
  course: { code: string; name: string };
  topics: Array<{ id: string; title: string; chunkCount: number; source: "Platform" | "Private" }>;
};

export function PracticeGenerator({ enrollments }: { enrollments: EnrollmentOption[] }) {
  const router = useRouter();
  const [enrollmentId, setEnrollmentId] = useState(enrollments[0]?.id ?? "");
  const [topicId, setTopicId] = useState("");
  const [questionCount, setQuestionCount] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const selectedEnrollment = useMemo(
    () => enrollments.find((item) => item.id === enrollmentId),
    [enrollmentId, enrollments],
  );

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enrollmentId || !topicId || isGenerating) return;
    setIsGenerating(true);
    setError("");

    try {
      const response = await fetch("/api/diagnostics/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId, topicId, questionCount }),
      });
      const result = await response.json() as { quizId?: string; message?: string };
      if (!response.ok || !result.quizId) {
        throw new Error(result.message ?? "Could not generate a diagnostic.");
      }
      router.push(`/practice/${result.quizId}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not generate a diagnostic.");
      setIsGenerating(false);
    }
  }

  return (
    <form onSubmit={generate} className="grid gap-4 rounded-lg border border-border bg-background p-5">
      <div>
        <h2 className="text-lg font-semibold">Generate a topic diagnostic</h2>
        <p className="mt-1 text-sm text-muted">Questions are generated only from material saved under the selected topic.</p>
      </div>
      <label className="grid gap-2 text-sm font-semibold">
        Course
        <select
          value={enrollmentId}
          onChange={(event) => {
            setEnrollmentId(event.target.value);
            setTopicId("");
          }}
          className="h-11 rounded-md border border-border bg-background px-3 font-normal"
        >
          {enrollments.map((enrollment) => (
            <option key={enrollment.id} value={enrollment.id}>
              {enrollment.course.code} - {enrollment.course.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-2 text-sm font-semibold">
        Topic
        <select
          required
          value={topicId}
          onChange={(event) => setTopicId(event.target.value)}
          className="h-11 rounded-md border border-border bg-background px-3 font-normal"
        >
          <option value="">Select a topic</option>
          {(selectedEnrollment?.topics ?? []).map((topic) => (
            <option key={topic.id} value={topic.id} disabled={topic.chunkCount === 0}>
              {topic.title} · {topic.source} ({topic.chunkCount} chunks)
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-2 text-sm font-semibold">
        Questions
        <select
          value={questionCount}
          onChange={(event) => setQuestionCount(Number(event.target.value))}
          className="h-11 rounded-md border border-border bg-background px-3 font-normal"
        >
          {[4, 5, 6, 8, 10].map((count) => <option key={count} value={count}>{count}</option>)}
        </select>
      </label>
      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
      <button
        disabled={isGenerating || !topicId}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-60"
      >
        {isGenerating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {isGenerating ? "Generating..." : "Generate diagnostic"}
      </button>
    </form>
  );
}
