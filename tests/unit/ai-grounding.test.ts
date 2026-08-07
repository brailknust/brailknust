import { describe, expect, it } from "vitest";

import { attachGroundingSources, evaluateGroundedAnswer, insufficientMaterialResponse, requiresCourseMaterial } from "@/features/ai/grounding";

describe("AI grounding policy", () => {
  it("requires evidence for subject-matter questions but not student-record questions", () => {
    expect(requiresCourseMaterial("Explain Kirchhoff's voltage law with an example")).toBe(true);
    expect(requiresCourseMaterial("What is my assessment score?")).toBe(false);
  });

  it("uses an explicit insufficient-material response", () => {
    const answer = insufficientMaterialResponse({ code: "COE 181", name: "Applied Electricity" });
    expect(evaluateGroundedAnswer({ answer, availableReferences: [], requiresGrounding: true })).toEqual(expect.objectContaining({ passed: true }));
  });

  it("rejects missing and invented citations", () => {
    expect(evaluateGroundedAnswer({ answer: "Voltage is measured in volts.", availableReferences: ["S1"], requiresGrounding: true }).issues).toContain("missing_citation");
    expect(evaluateGroundedAnswer({ answer: "Voltage is measured in volts [S9].", availableReferences: ["S1"], requiresGrounding: true }).issues).toContain("unknown_citation");
  });

  it("attaches retrieved sources to the following assistant answer", () => {
    const messages = attachGroundingSources([
      { id: "u", role: "USER", content: "Explain queues", createdAt: new Date(), contextUsed: { materialSources: [{ reference: "S1", materialTitle: "Queue notes", sourceType: "PLATFORM", topic: "Queues", pageLabel: null }] } },
      { id: "a", role: "ASSISTANT", content: "A queue is FIFO [S1].", createdAt: new Date(), contextUsed: null },
    ]);
    expect(messages[1].sources).toEqual([expect.objectContaining({ reference: "S1", materialTitle: "Queue notes" })]);
  });
});
