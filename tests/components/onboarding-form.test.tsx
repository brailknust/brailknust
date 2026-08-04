// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { OnboardingForm } from "@/app/onboarding/onboarding-form";
import {
  getKnustProgrammesForCollege,
  knustAcademicHierarchy,
} from "@/data/knust-academic-hierarchy";

describe("OnboardingForm", () => {
  it("enables only programmes belonging to the selected college", async () => {
    const user = userEvent.setup();
    const college = knustAcademicHierarchy.find(
      (item) => getKnustProgrammesForCollege(item.name).length > 0,
    )!;
    const programmeOptions = getKnustProgrammesForCollege(college.name);
    render(<OnboardingForm action={vi.fn()} hierarchy={knustAcademicHierarchy} defaultFullName="Phase Two Student" />);

    const programme = screen.getByLabelText("Programme");
    expect(programme).toBeDisabled();

    await user.selectOptions(screen.getByLabelText("College"), college.name);
    expect(programme).toBeEnabled();
    expect(screen.getByRole("option", { name: programmeOptions[0].name })).toBeInTheDocument();
  });
});
