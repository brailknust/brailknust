import { describe, expect, it } from "vitest";

import { titleFromFileName } from "@/features/materials/chat-material-upload";

describe("titleFromFileName", () => {
  it("strips the extension and title-cases separators", () => {
    expect(titleFromFileName("queue-notes_final.pdf")).toBe("queue notes final");
    expect(titleFromFileName("Lecture 4 Slides.pptx")).toBe("Lecture 4 Slides");
  });

  it("handles filenames with multiple dots by only stripping the last extension", () => {
    expect(titleFromFileName("chapter.4.notes.docx")).toBe("chapter.4.notes");
  });

  it("falls back to a placeholder for names that are only an extension or empty after cleanup", () => {
    expect(titleFromFileName(".pdf")).toBe("Untitled material");
    expect(titleFromFileName("___.txt")).toBe("Untitled material");
  });

  it("truncates to the server's 160-character title limit", () => {
    const longName = `${"a".repeat(200)}.pdf`;
    expect(titleFromFileName(longName).length).toBe(160);
  });
});
