// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SubmitEvent as ReactSubmitEvent } from "react";
import { describe, expect, it, vi } from "vitest";

import { ConfirmSubmitButton } from "@/components/confirm-submit-button";

describe("ConfirmSubmitButton", () => {
  it("requires confirmation and submits only after the destructive action is confirmed", async () => {
    const user = userEvent.setup();
    const submit = vi.fn((event: ReactSubmitEvent<HTMLFormElement>) => event.preventDefault());
    render(
      <form onSubmit={submit}>
        <ConfirmSubmitButton message="Delete this test record?">Delete record</ConfirmSubmitButton>
      </form>,
    );

    await user.click(screen.getByRole("button", { name: "Delete record" }));
    expect(screen.getByRole("dialog", { name: "Confirm deletion" })).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete record" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(submit).toHaveBeenCalledTimes(1);
  });
});
