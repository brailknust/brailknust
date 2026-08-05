import { describe, expect, it } from "vitest";
import { academicYearForLevel, curriculumTermSlots, provisionKey } from "@/features/academics/curriculum-provisioning";
describe("curriculum provisioning keys", () => {
  it("creates the eight stable Computer Engineering slots", () => { const slots = curriculumTermSlots(4, 2); expect(slots).toHaveLength(8); expect(slots[0]).toMatchObject({ level: "LEVEL_100", term: "FIRST" }); expect(slots[7]).toMatchObject({ level: "LEVEL_400", term: "SECOND" }); });
  it("keys a provisioned semester by curriculum, level and term", () => expect(provisionKey("version-id", "LEVEL_200", "SECOND")).toBe("curriculum:version-id:LEVEL_200:SECOND"));
  it("offsets each level's academic year from the selected active level", () => {
    expect(academicYearForLevel("2025/2026", "LEVEL_200", "LEVEL_100")).toBe("2024/2025");
    expect(academicYearForLevel("2025/2026", "LEVEL_200", "LEVEL_200")).toBe("2025/2026");
    expect(academicYearForLevel("2025/2026", "LEVEL_200", "LEVEL_300")).toBe("2026/2027");
    expect(academicYearForLevel("2025/2026", "LEVEL_200", "LEVEL_400")).toBe("2027/2028");
  });
});
