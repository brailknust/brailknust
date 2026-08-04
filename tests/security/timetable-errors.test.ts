import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSupabaseUser: vi.fn(),
  getAppUserByAuthId: vi.fn(),
  hasValidMaterialFileType: vi.fn(),
  extractTextFromImage: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock("@/features/auth/queries", () => ({
  getSupabaseUser: mocks.getSupabaseUser,
  getAppUserByAuthId: mocks.getAppUserByAuthId,
}));
vi.mock("@/features/materials/extract", () => ({
  materialFileExtension: () => "png",
  hasValidMaterialFileType: mocks.hasValidMaterialFileType,
}));
vi.mock("@/features/planner/timetable-ocr", () => ({
  extractTextFromImage: mocks.extractTextFromImage,
}));
vi.mock("@/server/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  rateLimitResponse: vi.fn(),
}));
vi.mock("@/server/db", () => ({ prisma: {} }));

import { POST } from "@/app/api/timetable/extract/route";

describe("timetable OCR errors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSupabaseUser.mockResolvedValue({ id: "auth-user" });
    mocks.getAppUserByAuthId.mockResolvedValue({ id: "app-user", activeSemesterId: null });
    mocks.checkRateLimit.mockResolvedValue({ allowed: true, retryAfter: 1 });
    mocks.hasValidMaterialFileType.mockResolvedValue(true);
  });

  it("does not return parser or provider exception details", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.extractTextFromImage.mockRejectedValue(new Error("provider-secret-detail"));
    const formData = new FormData();
    formData.set("image", new File([new Uint8Array([137, 80, 78, 71])], "timetable.png", { type: "image/png" }));

    const response = await POST(new Request("http://localhost/api/timetable/extract", {
      method: "POST",
      body: formData,
    }));
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.message).toBe("Could not read this timetable image. Try a clearer image or enter the rows manually.");
    expect(JSON.stringify(body)).not.toContain("provider-secret-detail");
    consoleError.mockRestore();
  });
});
