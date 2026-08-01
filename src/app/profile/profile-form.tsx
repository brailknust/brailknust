"use client";

import { useMemo, useState } from "react";

import { getKnustProgrammesForCollege, type KnustCollege } from "@/data/knust-academic-hierarchy";

const levels = [
  ["LEVEL_100", "Level 100"],
  ["LEVEL_200", "Level 200"],
  ["LEVEL_300", "Level 300"],
  ["LEVEL_400", "Level 400"],
  ["LEVEL_500", "Level 500"],
  ["LEVEL_600", "Level 600"],
] as const;

const cwaOptions = Array.from({ length: 101 }, (_, value) => value);
const fieldClassName =
  "h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:cursor-not-allowed disabled:bg-surface disabled:text-muted";
const labelClassName = "grid gap-2 text-sm font-semibold text-foreground";

type ProfileSemester = {
  id: string;
  name: string;
  academicYear: string;
  profile: {
    level: string | null;
    cwa: unknown;
  } | null;
};

type ProfileFormProps = {
  action: (formData: FormData) => void;
  hierarchy: KnustCollege[];
  semesters: ProfileSemester[];
  defaults: {
    fullName: string;
    studentId: string;
    college: string;
    programme: string;
    level: string;
    activeSemesterId: string;
    cwa: string;
  };
};

function formatLevel(value: string | null | undefined) {
  return value ? value.replace("LEVEL_", "Level ").replace("_", " ") : "Level not set";
}

export function ProfileForm({ action, hierarchy, semesters, defaults }: ProfileFormProps) {
  const [selectedCollege, setSelectedCollege] = useState(defaults.college);
  const [selectedProgramme, setSelectedProgramme] = useState(defaults.programme);

  const collegeOptions = useMemo(
    () => [...hierarchy].sort((a, b) => a.name.localeCompare(b.name)),
    [hierarchy],
  );

  const programmeOptions = useMemo(
    () => getKnustProgrammesForCollege(selectedCollege),
    [selectedCollege],
  );

  return (
    <form action={action} className="grid gap-5">
      <div className="rounded-lg border border-border bg-surface/70 p-4">
        <h2 className="text-base font-semibold">Personal details</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className={labelClassName}>
            Full name
            <input
              name="fullName"
              required
              defaultValue={defaults.fullName}
              className={fieldClassName}
            />
          </label>

          <label className={labelClassName}>
            Student ID
            <input
              name="studentId"
              required
              defaultValue={defaults.studentId}
              placeholder="e.g. 12345678"
              className={fieldClassName}
            />
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface/70 p-4">
        <h2 className="text-base font-semibold">Academic placement</h2>
        <div className="mt-4 grid gap-4">
          <label className={labelClassName}>
            College
            <select
              name="college"
              required
              value={selectedCollege}
              onChange={(event) => {
                setSelectedCollege(event.target.value);
                setSelectedProgramme("");
              }}
              className={fieldClassName}
            >
              <option value="">Select college</option>
              {collegeOptions.map((college) => (
                <option key={college.name} value={college.name}>
                  {college.name}
                </option>
              ))}
            </select>
          </label>

          <label className={labelClassName}>
            Programme
            <select
              name="programme"
              required
              value={selectedProgramme}
              disabled={!selectedCollege}
              onChange={(event) => setSelectedProgramme(event.target.value)}
              className={fieldClassName}
            >
              <option value="">{selectedCollege ? "Select programme" : "Select college first"}</option>
              {programmeOptions.map((option) => (
                <option key={`${option.college}-${option.department}-${option.name}`} value={option.name}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface/70 p-4">
        <h2 className="text-base font-semibold">Active semester</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className={labelClassName}>
            Semester
            <select name="activeSemesterId" defaultValue={defaults.activeSemesterId} className={fieldClassName}>
              <option value="">No active semester</option>
              {semesters.map((semester) => (
                <option key={semester.id} value={semester.id}>
                  {formatLevel(semester.profile?.level)} - {semester.name} ({semester.academicYear})
                </option>
              ))}
            </select>
          </label>

          <label className={labelClassName}>
            Level
            <select name="level" required defaultValue={defaults.level} className={fieldClassName}>
              {levels.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className={labelClassName}>
            Current CWA
            <select name="cwa" defaultValue={defaults.cwa} className={fieldClassName}>
              <option value="">Select percentage</option>
              {cwaOptions.map((value) => (
                <option key={value} value={value}>
                  {value}%
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <button
        type="submit"
        className="inline-flex h-12 items-center justify-center rounded-md bg-foreground px-5 text-sm font-semibold text-background transition hover:opacity-90"
      >
        Save profile
      </button>
    </form>
  );
}
