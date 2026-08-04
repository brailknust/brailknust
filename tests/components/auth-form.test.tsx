// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  signInWithOAuth: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      signUp: mocks.signUp,
      signInWithPassword: mocks.signInWithPassword,
      signInWithOAuth: mocks.signInWithOAuth,
    },
  }),
}));

import { AuthForm } from "@/components/auth-form";

describe("AuthForm", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects mismatched signup passwords before contacting Supabase", async () => {
    const user = userEvent.setup();
    render(<AuthForm mode="signup" />);

    await user.type(screen.getByLabelText("Full name"), "Phase Two Student");
    await user.type(screen.getByLabelText("Email address"), "phase2@example.com");
    await user.type(screen.getByLabelText("Password", { selector: "input" }), "secret12");
    await user.type(screen.getByLabelText("Confirm password", { selector: "input" }), "different12");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Passwords do not match.")).toBeInTheDocument();
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it("logs in and navigates to the dashboard", async () => {
    const user = userEvent.setup();
    mocks.signInWithPassword.mockResolvedValue({ error: null });
    render(<AuthForm mode="login" />);

    await user.type(screen.getByLabelText("Email address"), "phase2@example.com");
    await user.type(screen.getByLabelText("Password", { selector: "input" }), "secret12");
    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(mocks.signInWithPassword).toHaveBeenCalledWith({ email: "phase2@example.com", password: "secret12" });
    expect(mocks.push).toHaveBeenCalledWith("/dashboard");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("recovers when the authentication service cannot be reached", async () => {
    const user = userEvent.setup();
    mocks.signInWithPassword.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<AuthForm mode="login" />);

    await user.type(screen.getByLabelText("Email address"), "phase2@example.com");
    await user.type(screen.getByLabelText("Password", { selector: "input" }), "secret12");
    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(await screen.findByText("Failed to fetch")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Login" })).toBeEnabled();
  });

  it("turns an aborted authentication request into a retryable timeout message", async () => {
    const user = userEvent.setup();
    mocks.signInWithPassword.mockRejectedValue(new DOMException("Timed out", "TimeoutError"));
    render(<AuthForm mode="login" />);

    await user.type(screen.getByLabelText("Email address"), "phase2@example.com");
    await user.type(screen.getByLabelText("Password", { selector: "input" }), "secret12");
    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(await screen.findByText("Authentication timed out. Check your connection and try again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Login" })).toBeEnabled();
  });
});
