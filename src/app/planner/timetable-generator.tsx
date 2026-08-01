"use client";

import { ImageUp, Plus, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const weekDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

export type TimetableRow = {
  id: string;
  courseCode: string;
  courseName: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  venue: string;
  confidence: number;
};

type GeneratedSession = {
  id: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  subject: string;
  task: string;
  durationMinutes: number;
  priority: "high" | "medium" | "low";
  reason: string;
};

type GenerateSummary = {
  classCount: number;
  courseCount: number;
  plannedHours: number;
};

type StudyPlanResponse = {
  sessions?: GeneratedSession[];
  summary?: GenerateSummary | null;
  message?: string;
};

type PlannerPreferences = {
  sessionLength: number;
  preferredStart: string;
  preferredEnd: string;
  intensity: "light" | "balanced" | "intense";
};

function emptyRow(): TimetableRow {
  return {
    id: crypto.randomUUID(),
    courseCode: "",
    courseName: "",
    dayOfWeek: "Monday",
    startTime: "08:00",
    endTime: "10:00",
    venue: "",
    confidence: 1,
  };
}

function updateRow(rows: TimetableRow[], id: string, key: keyof TimetableRow, value: string | number) {
  return rows.map((row) => (row.id === id ? { ...row, [key]: value } : row));
}

type TimetableGeneratorProps = {
  activeCourseCount: number;
  initialRows: TimetableRow[];
};

export function TimetableGenerator({ activeCourseCount, initialRows }: TimetableGeneratorProps) {
  const router = useRouter();
  const [timetableImage, setTimetableImage] = useState<File | null>(null);
  const [extractedRows, setExtractedRows] = useState<TimetableRow[]>(initialRows);
  const [rawOcrText, setRawOcrText] = useState("");
  const [generatedSessions, setGeneratedSessions] = useState<GeneratedSession[]>([]);
  const [summary, setSummary] = useState<GenerateSummary | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [preferences, setPreferences] = useState<PlannerPreferences>({
    sessionLength: 60,
    preferredStart: "08:00",
    preferredEnd: "21:00",
    intensity: "balanced",
  });

  const groupedSessions = useMemo(() => {
    const groups = new Map<string, GeneratedSession[]>();

    for (const day of weekDays) {
      groups.set(day, []);
    }

    for (const session of generatedSessions) {
      groups.set(session.dayOfWeek, [...(groups.get(session.dayOfWeek) ?? []), session]);
    }

    return groups;
  }, [generatedSessions]);

  async function handleExtractTimetable(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setStatusMessage("");
    setRawOcrText("");

    if (!timetableImage) {
      setErrorMessage("Upload a timetable image first.");
      return;
    }

    if (timetableImage.size > 6 * 1024 * 1024) {
      setErrorMessage("This image is too large for local OCR. Upload a screenshot under 6MB.");
      return;
    }

    const formData = new FormData();
    formData.append("image", timetableImage);
    setIsExtracting(true);
    setStatusMessage("Reading timetable image. This can take up to 45 seconds for large photos.");

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 60_000);

    try {
      const response = await fetch("/api/timetable/extract", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      const data = (await response.json().catch(() => null)) as {
        rows?: TimetableRow[];
        rawText?: string;
        message?: string;
      } | null;

      if (!response.ok || !data?.rows) {
        setErrorMessage(data?.message ?? "Could not extract the timetable image.");
        setStatusMessage("");
        return;
      }

      setExtractedRows(data.rows);
      setRawOcrText(data.rawText ?? "");
      setGeneratedSessions([]);
      setSummary(null);
      setStatusMessage(data.message ?? "Timetable rows extracted. Review them before generating your plan.");
    } catch (error) {
      setStatusMessage("");
      setErrorMessage(
        error instanceof DOMException && error.name === "AbortError"
          ? "Extraction timed out. Try a smaller, clearer screenshot or add classes manually."
          : "Could not extract the timetable image.",
      );
    } finally {
      window.clearTimeout(timeout);
      setIsExtracting(false);
    }
  }

  async function handleGeneratePlan() {
    setErrorMessage("");
    setStatusMessage("");
    setIsGenerating(true);

    try {
      const response = await fetch("/api/study-plan/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rows: extractedRows,
          preferences,
        }),
      });
      const data = (await response.json().catch(() => null)) as StudyPlanResponse | null;

      if (!response.ok || !data?.sessions) {
        setErrorMessage(data?.message ?? "Could not generate a study plan.");
        return;
      }

      setGeneratedSessions(data.sessions);
      setSummary(data.summary ?? null);
      setStatusMessage("Personal study timetable generated and saved. Your reviewed class rows remain available for regeneration.");
      router.refresh();
    } catch {
      setErrorMessage("Could not generate a study plan.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-background p-5">
      <div className="flex items-center gap-3">
        <ImageUp className="h-5 w-5 text-accent" />
        <h2 className="text-lg font-semibold">Generate study timetable</h2>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted">
        Upload a clear timetable image, review the OCR rows, then generate a personal study week
        around your class times.
      </p>

      <form onSubmit={handleExtractTimetable} className="mt-5 grid gap-3">
        <label className="grid gap-2 text-sm font-semibold">
          Timetable image
          <input
            type="file"
            accept="image/*"
            onChange={(event) => setTimetableImage(event.target.files?.[0] ?? null)}
            className="rounded-md border border-border bg-surface px-3 py-3 text-sm font-normal file:mr-4 file:rounded-md file:border-0 file:bg-foreground file:px-4 file:py-2 file:text-sm file:font-semibold file:text-background"
          />
        </label>
        <button
          type="submit"
          disabled={isExtracting}
          className="h-11 rounded-md bg-foreground px-4 text-sm font-semibold text-background disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isExtracting ? "Extracting..." : "Extract timetable"}
        </button>
      </form>

      {statusMessage ? (
        <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {statusMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {errorMessage}
        </p>
      ) : null}

      <div className="mt-5 grid gap-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold">Extracted class rows</h3>
          <button
            type="button"
            onClick={() => setExtractedRows((rows) => [...rows, emptyRow()])}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold"
          >
            <Plus className="h-4 w-4" />
            Add row
          </button>
        </div>

        {extractedRows.length ? (
          <div className="grid gap-3">
            {extractedRows.map((row) => (
              <div key={row.id} className="rounded-md border border-border bg-surface p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    value={row.courseCode}
                    onChange={(event) =>
                      setExtractedRows((rows) => updateRow(rows, row.id, "courseCode", event.target.value))
                    }
                    placeholder="Course code"
                    className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                  />
                  <input
                    value={row.courseName}
                    onChange={(event) =>
                      setExtractedRows((rows) => updateRow(rows, row.id, "courseName", event.target.value))
                    }
                    placeholder="Course name"
                    className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                  />
                  <select
                    value={row.dayOfWeek}
                    onChange={(event) =>
                      setExtractedRows((rows) => updateRow(rows, row.id, "dayOfWeek", event.target.value))
                    }
                    className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                  >
                    {weekDays.map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                  <input
                    value={row.venue}
                    onChange={(event) =>
                      setExtractedRows((rows) => updateRow(rows, row.id, "venue", event.target.value))
                    }
                    placeholder="Venue"
                    className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                  />
                  <input
                    type="time"
                    value={row.startTime}
                    onChange={(event) =>
                      setExtractedRows((rows) => updateRow(rows, row.id, "startTime", event.target.value))
                    }
                    className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                  />
                  <div className="flex gap-2">
                    <input
                      type="time"
                      value={row.endTime}
                      onChange={(event) =>
                        setExtractedRows((rows) => updateRow(rows, row.id, "endTime", event.target.value))
                      }
                      className="h-10 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setExtractedRows((rows) => rows.filter((item) => item.id !== row.id))}
                      className="grid h-10 w-10 place-items-center rounded-md border border-border text-muted transition hover:border-foreground hover:text-foreground"
                      aria-label="Remove row"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-md border border-border bg-surface p-4 text-sm text-muted">
            No class rows yet. Generate from your enrolled courses, upload an image, or add rows manually.
          </p>
        )}
      </div>

      <div className="mt-5 rounded-md border border-border bg-surface p-4">
        <h3 className="font-semibold">Study preferences</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold">
            Session length
            <select
              value={preferences.sessionLength}
              onChange={(event) =>
                setPreferences((current) => ({ ...current, sessionLength: Number(event.target.value) }))
              }
              className="h-10 rounded-md border border-border bg-background px-3 text-sm font-normal"
            >
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>60 minutes</option>
              <option value={90}>90 minutes</option>
              <option value={120}>120 minutes</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Intensity
            <select
              value={preferences.intensity}
              onChange={(event) =>
                setPreferences((current) => ({
                  ...current,
                  intensity: event.target.value as PlannerPreferences["intensity"],
                }))
              }
              className="h-10 rounded-md border border-border bg-background px-3 text-sm font-normal"
            >
              <option value="light">Light</option>
              <option value="balanced">Balanced</option>
              <option value="intense">Intense</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Preferred start
            <input
              type="time"
              value={preferences.preferredStart}
              onChange={(event) =>
                setPreferences((current) => ({ ...current, preferredStart: event.target.value }))
              }
              className="h-10 rounded-md border border-border bg-background px-3 text-sm font-normal"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            Preferred end
            <input
              type="time"
              value={preferences.preferredEnd}
              onChange={(event) =>
                setPreferences((current) => ({ ...current, preferredEnd: event.target.value }))
              }
              className="h-10 rounded-md border border-border bg-background px-3 text-sm font-normal"
            />
          </label>
        </div>
        {activeCourseCount === 0 ? (
          <p className="mt-4 rounded-md border border-border bg-background p-3 text-sm text-muted">
            Add at least one course to your active semester before generating a study timetable.
          </p>
        ) : null}
        <button
          type="button"
          onClick={handleGeneratePlan}
          disabled={activeCourseCount === 0 || isGenerating}
          className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-semibold text-background disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Sparkles className="h-4 w-4" />
          {isGenerating ? "Generating..." : extractedRows.length ? "Generate around class times" : "Generate from enrolled courses"}
        </button>
      </div>

      {summary ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-border bg-surface p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Classes</p>
            <p className="mt-2 font-semibold">{summary.classCount}</p>
          </div>
          <div className="rounded-md border border-border bg-surface p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Courses</p>
            <p className="mt-2 font-semibold">{summary.courseCount}</p>
          </div>
          <div className="rounded-md border border-border bg-surface p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Planned hours</p>
            <p className="mt-2 font-semibold">{summary.plannedHours}</p>
          </div>
        </div>
      ) : null}

      {generatedSessions.length ? (
        <div className="mt-5 grid gap-3">
          <h3 className="font-semibold">Generated preview</h3>
          {weekDays.map((day) => {
            const sessions = groupedSessions.get(day) ?? [];
            if (!sessions.length) return null;

            return (
              <div key={day} className="rounded-md border border-border bg-surface p-3">
                <p className="font-semibold">{day}</p>
                <div className="mt-2 grid gap-2">
                  {sessions.map((session) => (
                    <p key={session.id} className="text-sm text-muted">
                      {session.startTime}-{session.endTime}: {session.subject} - {session.task}
                    </p>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {rawOcrText ? (
        <details className="mt-5 rounded-md border border-border bg-surface p-4 text-sm text-muted">
          <summary className="cursor-pointer font-semibold text-foreground">Raw OCR text</summary>
          <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap">{rawOcrText}</pre>
        </details>
      ) : null}
    </section>
  );
}


