import { describe, expect, it } from "vitest";

import { formatFileSize } from "@/features/ai/chat-client";

describe("formatFileSize", () => {
  it("returns null for missing or zero sizes", () => {
    expect(formatFileSize(null)).toBeNull();
    expect(formatFileSize(0)).toBeNull();
  });

  it("formats sub-kilobyte sizes in bytes", () => {
    expect(formatFileSize(512)).toBe("512 B");
  });

  it("formats kilobyte-range sizes rounded to the nearest KB", () => {
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(1500)).toBe("1 KB");
  });

  it("formats megabyte-range sizes to one decimal place", () => {
    expect(formatFileSize(5.6 * 1024 * 1024)).toBe("5.6 MB");
    expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
  });
});
