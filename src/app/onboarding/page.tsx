import { redirect } from "next/navigation";

import { knustAcademicHierarchy } from "@/data/knust-academic-hierarchy";
import { completeProfile } from "@/features/profile/actions";
import { getAppUserByAuthId, requireSupabaseUser } from "@/features/auth/queries";
import { OnboardingForm } from "@/app/onboarding/onboarding-form";

export default async function OnboardingPage() {
  const authUser = await requireSupabaseUser();
  const appUser = await getAppUserByAuthId(authUser.id);

  if (appUser) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-surface px-6 py-10 text-foreground">
      <section className="mx-auto w-full max-w-3xl rounded-lg border border-border bg-background p-5 shadow-sm sm:p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">
          Profile setup
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal">
          Tell BRAIL about your semester
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          This creates your app profile and gives the planner the first academic context it needs.
        </p>

        <OnboardingForm
          action={completeProfile}
          hierarchy={knustAcademicHierarchy}
          defaultFullName={authUser.user_metadata.full_name ?? authUser.email ?? ""}
        />
      </section>
    </main>
  );
}
