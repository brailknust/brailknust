"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

import { GoogleIcon } from "@/components/google-icon";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type AuthFormProps = {
  mode: "login" | "signup";
};

const subscribeToHydration = () => () => undefined;

function authErrorMessage(error: unknown) {
  if (error instanceof DOMException && ["AbortError", "TimeoutError"].includes(error.name)) {
    return "Authentication timed out. Check your connection and try again.";
  }
  return error instanceof Error ? error.message : "Could not reach the authentication service.";
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedNext = searchParams.get("next");
  const nextPath = requestedNext?.startsWith("/") ? requestedNext : "/dashboard";
  const isSignup = mode === "signup";
  const isHydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const [isPending, setIsPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleSignIn() {
    setIsPending(true);
    setError(null);
    setMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const callbackNext = isSignup ? "/onboarding" : nextPath;
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(callbackNext)}`,
          queryParams: {
            prompt: "select_account",
          },
        },
      });

      if (signInError) setError(signInError.message);
    } catch (authError) {
      setError(authErrorMessage(authError));
    } finally {
      setIsPending(false);
    }
  }

  async function handleEmailSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);
    setMessage(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");
    const fullName = String(formData.get("fullName") ?? "");
    if (isSignup && password !== confirmPassword) {
      setError("Passwords do not match.");
      setIsPending(false);
      return;
    }

    try {
      const supabase = createSupabaseBrowserClient();

      if (isSignup) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/onboarding")}`,
          },
        });

        if (signUpError) {
          setError(signUpError.message);
          setIsPending(false);
          return;
        }

        if (!data.session) {
          setMessage("Account created. Email confirmation is still enabled in Supabase, so check your email or turn it off in Auth settings.");
          setIsPending(false);
          return;
        }

        router.push("/onboarding");
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setIsPending(false);
        return;
      }

      router.push(nextPath);
    } catch (authError) {
      setError(authErrorMessage(authError));
      setIsPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={!isHydrated || isPending}
        className="mt-8 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-white px-5 text-sm font-semibold text-foreground hover:border-accent hover:bg-[var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
        Continue with Google
      </button>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleEmailSubmit} className="grid gap-4">
        {isSignup ? (
          <label className="grid gap-2 text-sm font-semibold">
            Full name
            <input
              name="fullName"
              required
              placeholder="Your full name"
              className="h-11 rounded-xl border border-border bg-white px-3 text-sm font-normal outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
            />
          </label>
        ) : null}

        <label className="grid gap-2 text-sm font-semibold">
          Email address
          <input
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            className="h-11 rounded-md border border-border bg-background px-3 text-sm font-normal outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/15"
          />
        </label>

        <label className="grid gap-2 text-sm font-semibold">
          Password
          <div className="flex h-11 overflow-hidden rounded-xl border border-border bg-white focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15">
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              required
              minLength={6}
              placeholder={isSignup ? "Create a password" : "Enter your password"}
              className="min-w-0 flex-1 bg-transparent px-3 text-sm font-normal outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="border-l border-border px-3 text-xs font-semibold text-muted transition hover:text-foreground"
            >
              {showPassword ? "Hide" : "View"}
            </button>
          </div>
        </label>

        {isSignup ? (
          <label className="grid gap-2 text-sm font-semibold">
            Confirm password
            <div className="flex h-11 overflow-hidden rounded-xl border border-border bg-white focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15">
              <input
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                required
                minLength={6}
                placeholder="Confirm your password"
                className="min-w-0 flex-1 bg-transparent px-3 text-sm font-normal outline-none"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((current) => !current)}
                className="border-l border-border px-3 text-xs font-semibold text-muted transition hover:text-foreground"
              >
                {showConfirmPassword ? "Hide" : "View"}
              </button>
            </div>
          </label>
        ) : null}

        <button
          disabled={!isHydrated || isPending}
          className="mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {isSignup ? "Create account" : "Login"}
        </button>
      </form>

      {error ? (
        <p data-testid="auth-error" className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {message ? (
        <p className="mt-4 rounded-md border border-border bg-surface px-3 py-2 text-sm text-muted">
          {message}
        </p>
      ) : null}

      <p className="mt-6 text-center text-sm text-muted">
        {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
        <Link href={isSignup ? "/login" : "/signup"} className="font-semibold text-accent hover:underline">
          {isSignup ? "Login" : "Sign up"}
        </Link>
      </p>
    </>
  );
}
