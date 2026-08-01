import { LoginForm } from "@/app/login/login-form";
import { AuthCardShell } from "@/components/auth-card-shell";
import { Suspense } from "react";

export default function LoginPage() {
  return (
    <AuthCardShell
      eyebrow="Welcome back"
      title="Login to BRAIL"
      description="Access your planner, deadlines, active semester, and academic workspace."
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthCardShell>
  );
}
