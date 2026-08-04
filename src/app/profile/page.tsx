import { Mail, School, UserRound } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { knustAcademicHierarchy } from "@/data/knust-academic-hierarchy";
import { requireAppUser } from "@/features/auth/queries";
import { deleteAccount, updateProfile } from "@/features/profile/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
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
        <article className="rounded-2xl border border-border bg-[var(--accent-strong)] p-5 text-white">
          <UserRound className="h-5 w-5 text-white/75" />
          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.14em] text-white/60">
            Student
          </p>
          <h2 className="mt-2 text-2xl font-semibold">{appUser.fullName}</h2>
          <p className="mt-1 text-sm text-white/70">{appUser.studentId ?? "Student ID not set"}</p>
        </article>

        <article className="rounded-2xl border border-border bg-white p-5">
          <Mail className="h-5 w-5 text-accent" />
          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.14em] text-muted">
            Account email
          </p>
          <h2 className="mt-2 break-words text-xl font-semibold">
            {authUser.email ?? appUser.email}
          </h2>
          <p className="mt-1 text-sm text-muted">Managed by Supabase Auth</p>
        </article>

        <article className="rounded-2xl border border-border bg-white p-5">
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
        <aside className="rounded-2xl border border-border bg-white p-5">
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

        <section className="rounded-2xl border border-border bg-white p-5">
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

      <section className="mt-6 rounded-2xl border border-border bg-white p-5">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">Your data</p>
        <h2 className="mt-2 text-xl font-semibold">Download an account export</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Export your profile, academic history, plans, AI conversations, diagnostics, peer activity, notifications, and material metadata as JSON.
        </p>
        <a href="/api/account/export" className="mt-4 inline-flex h-10 items-center rounded-xl bg-[var(--accent-strong)] px-4 text-sm font-semibold text-white">
          Download JSON export
        </a>
      </section>

      <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-red-700">Danger zone</p>
        <h2 className="mt-2 text-xl font-semibold">Delete your account</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Download an export first. Private academic data and files will be permanently removed. Peer discussions with replies are retained under “Deleted student”; unanswered questions are removed.
        </p>
        <form action={deleteAccount} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="grid gap-1 text-sm font-medium">
            Type DELETE to confirm
            <input name="confirmation" required autoComplete="off" className="h-10 rounded-xl border border-red-200 bg-white px-3" />
          </label>
          <ConfirmSubmitButton
            message="This permanently removes your login, private academic records, uploaded files, plans, AI conversations, and diagnostics. This cannot be undone."
            titleText="Delete account permanently"
            confirmLabel="Delete my account"
            className="h-10 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white"
          >
            Delete account
          </ConfirmSubmitButton>
        </form>
      </section>
    </AppShell>
  );
}
