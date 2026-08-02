import { BookOpen } from "lucide-react";
import Link from "next/link";
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
    <main className="min-h-screen bg-white px-5 py-8 text-foreground sm:px-8 sm:py-10">
      <section className="mx-auto w-full max-w-4xl">
        <Link href="/" className="mb-10 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-white"><BookOpen className="h-5 w-5" /></span>
          <span className="font-semibold">BRAIL KNUST</span>
        </Link>
        <div className="rounded-2xl border border-border bg-white p-5 shadow-[0_24px_70px_rgba(4,92,46,0.07)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
          Profile setup
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
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
        </div>
      </section>
    </main>
  );
}
