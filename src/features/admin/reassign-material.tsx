"use client";

import { useMemo, useState, useTransition } from "react";
import type { FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";

import { getReassignableCourses, reassignPlatformMaterial } from "@/features/admin/actions";

type ReassignableCourse = { id: string; code: string; name: string; topics: Array<{ id: string; title: string }> };

export function ReassignMaterial({ material }: { material: { id: string; title: string } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState<ReassignableCourse[] | null>(null);
  const [query, setQuery] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function reset() {
    setOpen(false);
    setSelectedCourseId("");
    setQuery("");
    setError("");
  }

  async function openPanel() {
    setOpen(true);
    setError("");
    if (courses) return;
    setLoading(true);
    try {
      setCourses(await getReassignableCourses());
    } catch {
      setError("Could not load the course list.");
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    if (!courses) return [];
    const search = query.trim().toLocaleLowerCase();
    if (!search) return courses;
    return courses.filter((course) => `${course.code} ${course.name}`.toLocaleLowerCase().includes(search));
  }, [courses, query]);

  const selectedCourse = courses?.find((course) => course.id === selectedCourseId) ?? null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        await reassignPlatformMaterial(formData);
        reset();
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not move this material.");
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={openPanel}
        className="rounded-md border border-border bg-white px-2.5 py-1.5 text-xs font-semibold text-muted"
      >
        Move
      </button>
    );
  }

  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Move &ldquo;{material.title}&rdquo;</p>
      {loading ? (
        <p className="mt-2 flex items-center gap-2 text-xs text-muted">
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Loading courses…
        </p>
      ) : (
        <form onSubmit={submit} className="mt-2 grid gap-2">
          <input type="hidden" name="materialId" value={material.id} />
          <input type="hidden" name="targetCourseId" value={selectedCourseId} />
          <label className="grid gap-1 text-xs font-semibold text-muted">
            Destination course
            <input
              type="text"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedCourseId("");
              }}
              placeholder="Search by course code or name"
              className="h-9 rounded-md border border-border bg-white px-2 text-xs font-normal text-foreground"
            />
          </label>
          {query && !selectedCourseId ? (
            <ul className="max-h-40 overflow-y-auto rounded-md border border-border bg-white text-xs">
              {filtered.length ? filtered.map((course) => (
                <li key={course.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCourseId(course.id);
                      setQuery(`${course.code} — ${course.name}`);
                    }}
                    className="block w-full px-2 py-1.5 text-left hover:bg-surface"
                  >
                    <span className="font-semibold">{course.code}</span> {course.name}
                  </button>
                </li>
              )) : <li className="px-2 py-1.5 text-muted">No matching course.</li>}
            </ul>
          ) : null}
          {selectedCourse ? (
            selectedCourse.topics.length ? (
              <label className="grid gap-1 text-xs font-semibold text-muted">
                Destination topics
                <select
                  name="targetTopicIds"
                  required
                  multiple
                  size={Math.min(Math.max(selectedCourse.topics.length, 2), 6)}
                  className="min-h-16 rounded-md border border-border bg-white px-2 py-1 text-xs font-normal text-foreground"
                >
                  {selectedCourse.topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}
                </select>
              </label>
            ) : (
              <p className="text-xs text-muted">{selectedCourse.code} has no topics yet — add one first.</p>
            )
          ) : null}
          {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending || !selectedCourseId || !selectedCourse?.topics.length}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-foreground px-3 text-xs font-semibold text-background disabled:opacity-60"
            >
              {pending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
              {pending ? "Moving…" : "Move material"}
            </button>
            <button
              type="button"
              onClick={reset}
              className="h-8 rounded-md border border-border px-3 text-xs font-semibold text-muted"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
