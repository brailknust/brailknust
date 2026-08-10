// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { OnboardingForm } from "@/app/onboarding/onboarding-form";
import type { OnboardingFormState } from "@/features/profile/actions";
import {
  getKnustProgrammesForCollege,
  knustAcademicHierarchy,
} from "@/data/knust-academic-hierarchy";

const action = vi.fn(async (state: OnboardingFormState, formData: FormData) => {
  void state;
  void formData;
  return { message: null };
});

describe("OnboardingForm", () => {
  it("enables only programmes belonging to the selected college", async () => {
    const user = userEvent.setup();
    const college = knustAcademicHierarchy.find(
      (item) => getKnustProgrammesForCollege(item.name).length > 0,
    )!;
    const programmeOptions = getKnustProgrammesForCollege(college.name);
    render(<OnboardingForm action={action} hierarchy={knustAcademicHierarchy} defaultFullName="Phase Two Student" />);

    const programme = screen.getByLabelText("Programme");
    expect(programme).toBeDisabled();

    await user.selectOptions(screen.getByLabelText("College"), college.name);
    expect(programme).toBeEnabled();
    expect(screen.getByRole("option", { name: programmeOptions[0].name })).toBeInTheDocument();
  });

  it("requires Student ID for normal student accounts", () => {
    render(<OnboardingForm action={action} hierarchy={knustAcademicHierarchy} defaultFullName="Phase Two Student" />);

    expect(screen.getByLabelText("Student ID")).toBeRequired();
  });

  it("allows configured admin accounts to continue without Student ID", () => {
    render(
      <OnboardingForm
        action={action}
        hierarchy={knustAcademicHierarchy}
        defaultFullName="BRAIL Admin"
        isConfiguredAdmin
      />,
    );

    expect(screen.getByLabelText("Student ID")).not.toBeRequired();
    expect(screen.getByText("Optional for configured admin accounts.")).toBeInTheDocument();
  });
});
