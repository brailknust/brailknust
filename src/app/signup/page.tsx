import { AuthCardShell } from "@/components/auth-card-shell";
import { AuthForm } from "@/components/auth-form";
import { Suspense } from "react";

export default function SignupPage() {
  return (
    <AuthCardShell
      eyebrow="Create your account"
      title="Sign up for BRAIL"
      description="Start with your account, then BRAIL will ask for your KNUST academic placement."
    >
      <Suspense>
        <AuthForm mode="signup" />
      </Suspense>
    </AuthCardShell>
  );
}
