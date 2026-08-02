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

const semesterOptions = ["First Semester", "Second Semester"] as const;
const cwaOptions = Array.from({ length: 101 }, (_, value) => value);
const defaultAcademicYear = "2025/2026";
const currentYear = new Date().getFullYear();
const academicYearOptions = Array.from({ length: 7 }, (_, index) => {
  const startYear = currentYear - 2 + index;
  return `${startYear}/${startYear + 1}`;
});
const fieldClassName =
  "h-11 rounded-xl border border-border bg-white px-3 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:cursor-not-allowed disabled:bg-surface disabled:text-muted";
const labelClassName = "grid gap-2 text-sm font-semibold text-foreground";

type OnboardingFormProps = {
  action: (formData: FormData) => void;
  hierarchy: KnustCollege[];
  defaultFullName: string;
};

export function OnboardingForm({ action, hierarchy, defaultFullName }: OnboardingFormProps) {
  const [selectedCollege, setSelectedCollege] = useState("");
  const [selectedProgramme, setSelectedProgramme] = useState("");

  const collegeOptions = useMemo(
    () => [...hierarchy].sort((a, b) => a.name.localeCompare(b.name)),
    [hierarchy],
  );

  const programmeOptions = useMemo(
    () => getKnustProgrammesForCollege(selectedCollege),
    [selectedCollege],
  );

  return (
    <form action={action} className="mt-8 grid gap-5">
      <div className="rounded-xl border border-border bg-white p-5">
        <h2 className="text-base font-semibold">Personal details</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className={labelClassName}>
            Full name
            <input
              name="fullName"
              required
              defaultValue={defaultFullName}
              className={fieldClassName}
            />
          </label>

          <label className={labelClassName}>
            Student ID
            <input
              name="studentId"
              required
              placeholder="e.g. 12345678"
              className={fieldClassName}
            />
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white p-5">
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
              <option value="">
                {selectedCollege ? "Select programme" : "Select college first"}
              </option>
              {programmeOptions.map((option) => (
                <option key={`${option.college}-${option.department}-${option.name}`} value={option.name}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white p-5">
        <h2 className="text-base font-semibold">Current semester</h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          If BRAIL has a curriculum template for your programme, matching courses will be added automatically.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className={labelClassName}>
            Semester
            <select
              name="semesterName"
              required
              defaultValue="First Semester"
              className={fieldClassName}
            >
              {semesterOptions.map((semester) => (
                <option key={semester} value={semester}>
                  {semester}
                </option>
              ))}
            </select>
          </label>

          <label className={labelClassName}>
            Academic year
            <select
              name="academicYear"
              required
              defaultValue={defaultAcademicYear}
              className={fieldClassName}
            >
              {academicYearOptions.map((academicYear) => (
                <option key={academicYear} value={academicYear}>
                  {academicYear}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white p-5">
        <h2 className="text-base font-semibold">Current standing</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className={labelClassName}>
            Level
            <select name="level" required defaultValue="LEVEL_100" className={fieldClassName}>
              {levels.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className={labelClassName}>
            Current CWA
            <select name="cwa" defaultValue="" className={fieldClassName}>
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
        className="mt-2 inline-flex h-12 items-center justify-center rounded-xl bg-accent px-5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--accent-strong)]"
      >
        Create profile
      </button>
    </form>
  );
}
