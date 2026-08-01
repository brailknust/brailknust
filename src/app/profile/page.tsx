import { Mail, School, UserRound } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { knustAcademicHierarchy } from "@/data/knust-academic-hierarchy";
import { requireAppUser } from "@/features/auth/queries";
import { updateProfile } from "@/features/profile/actions";
import { getProfileSemesters } from "@/features/profile/queries";
import { ProfileForm } from "@/app/profile/profile-form";

function formatCwa(value: unknown) {
  return value ? `${value.toString()}%` : "Not set";
}

function formatLevel(value: string | null | undefined) {
  return value ? value.replace("LEVEL_", "Level ").replace("_", " ") : "Not set";
}

export default async function ProfilePage() {
  const { appUser, authUser } = await requireAppUser();
  const semesters = await getProfileSemesters(appUser.id);
  const activeSemester = semesters.find((semester) => semester.id === appUser.activeSemesterId);
  const activeProfile = activeSemester?.profile;
  const cwaValue = activeProfile?.cwa ?? appUser.cwa;

  return (
    <AppShell title="Profile" eyebrow="Account">
      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-lg border border-border bg-foreground p-5 text-background">
          <UserRound className="h-5 w-5 text-background/75" />
          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.14em] text-background/60">
            Student
          </p>
          <h2 className="mt-2 text-2xl font-semibold">{appUser.fullName}</h2>
          <p className="mt-1 text-sm text-background/70">{appUser.studentId ?? "Student ID not set"}</p>
        </article>

        <article className="rounded-lg border border-border bg-background p-5">
          <Mail className="h-5 w-5 text-accent" />
          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.14em] text-muted">
            Account email
          </p>
          <h2 className="mt-2 break-words text-xl font-semibold">
            {authUser.email ?? appUser.email}
          </h2>
          <p className="mt-1 text-sm text-muted">Managed by Supabase Auth</p>
        </article>

        <article className="rounded-lg border border-border bg-background p-5">
          <School className="h-5 w-5 text-accent" />
          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.14em] text-muted">
            Active semester
          </p>
          <h2 className="mt-2 text-xl font-semibold">
            {activeSemester
              ? `${formatLevel(activeProfile?.level ?? appUser.level)} - ${activeSemester.name}`
              : "Not set"}
          </h2>
          <p className="mt-1 text-sm text-muted">CWA: {formatCwa(cwaValue)}</p>
        </article>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
        <aside className="rounded-lg border border-border bg-background p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">
            Academic record
          </p>
          <div className="mt-5 grid gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                College
              </p>
              <p className="mt-2 font-semibold">{appUser.college ?? "Not set"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                Programme
              </p>
              <p className="mt-2 font-semibold">{appUser.programme ?? "Not set"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                Department
              </p>
              <p className="mt-2 font-semibold">{appUser.department ?? "Derived from programme"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                Semesters
              </p>
              <p className="mt-2 font-semibold">{semesters.length}</p>
            </div>
          </div>
        </aside>

        <section className="rounded-lg border border-border bg-background p-5">
          <div className="mb-5">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">
              Edit profile
            </p>
            <h2 className="mt-2 text-xl font-semibold">Update your academic setup</h2>
          </div>
          <ProfileForm
            action={updateProfile}
            hierarchy={knustAcademicHierarchy}
            semesters={semesters}
            defaults={{
              fullName: appUser.fullName,
              studentId: appUser.studentId ?? "",
              college: appUser.college ?? "",
              programme: appUser.programme ?? "",
              level: activeProfile?.level ?? appUser.level ?? "LEVEL_100",
              activeSemesterId: appUser.activeSemesterId ?? "",
              cwa: cwaValue ? String(Math.round(Number(cwaValue))) : "",
            }}
          />
        </section>
      </section>
    </AppShell>
  );
}
