import { describe, expect, it } from "vitest";

import { chunkMaterialText } from "@/features/materials/chunking";
import {
  hasValidMaterialFileType,
  materialFileExtension,
} from "@/features/materials/extract";

describe("course material processing", () => {
  it("normalizes and chunks long text with bounded overlap", () => {
    const source = Array.from({ length: 180 }, (_, index) => `Concept ${index} explains a useful engineering principle.`).join(" ");
    const chunks = chunkMaterialText(source);

    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.every((chunk) => chunk.length <= 1601)).toBe(true);
    expect(chunkMaterialText("  \r\n  ")).toEqual([]);
  });

  it("checks extensions and leading file signatures", async () => {
    expect(materialFileExtension("Lecture.NOTES.PDF")).toBe("pdf");
    const validPdf = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], "lecture.pdf", { type: "application/pdf" });
    const fakePdf = new File(["not a pdf"], "lecture.pdf", { type: "application/pdf" });

    await expect(hasValidMaterialFileType(validPdf)).resolves.toBe(true);
    await expect(hasValidMaterialFileType(fakePdf)).resolves.toBe(false);
  });
});
