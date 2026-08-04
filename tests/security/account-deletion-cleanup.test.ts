import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  update: vi.fn(),
  removeCourseMaterialFiles: vi.fn(),
  deleteAuthUser: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/db", () => ({
  prisma: { user: { findFirst: mocks.findFirst, update: mocks.update } },
}));
vi.mock("@/features/materials/storage", () => ({
  removeCourseMaterialFiles: mocks.removeCourseMaterialFiles,
}));
vi.mock("@/server/supabase", () => ({
  createSupabaseServiceClient: () => ({
    auth: { admin: { deleteUser: mocks.deleteAuthUser } },
  }),
}));

import { finalizeAccountDeletionCleanup } from "@/features/profile/account-deletion";

const deletedUser = {
  id: "00000000-0000-4000-8000-000000000002",
  authUserId: "00000000-0000-4000-8000-000000000102",
  deletionStoragePaths: ["user/material.pdf"],
  deletionStoragePending: true,
  deletionAuthPending: true,
};

describe("account deletion external cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.update.mockResolvedValue({});
    mocks.deleteAuthUser.mockResolvedValue({ error: null });
  });

  it("records each completed external deletion step", async () => {
    mocks.findFirst.mockResolvedValue(deletedUser);
    mocks.removeCourseMaterialFiles.mockResolvedValue(undefined);
    mocks.deleteAuthUser.mockResolvedValue({ error: null });

    await expect(finalizeAccountDeletionCleanup(deletedUser.id)).resolves.toBe(true);
    expect(mocks.removeCourseMaterialFiles).toHaveBeenCalledWith(["user/material.pdf"]);
    expect(mocks.deleteAuthUser).toHaveBeenCalledWith(deletedUser.authUserId);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { deletionStoragePending: false, deletionStoragePaths: [] },
    }));
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { deletionAuthPending: false },
    }));
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ deletionCompletedAt: expect.any(Date), deletionLastError: null }),
    }));
  });

  it("retains a generic retry state without leaking provider details", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.findFirst.mockResolvedValue(deletedUser);
    mocks.removeCourseMaterialFiles.mockRejectedValue(new Error("private-provider-token"));

    await expect(finalizeAccountDeletionCleanup(deletedUser.id)).resolves.toBe(false);
    expect(mocks.deleteAuthUser).toHaveBeenCalledWith(deletedUser.authUserId);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { deletionAuthPending: false },
    }));
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { deletionLastError: "External account cleanup requires administrator retry." },
    }));
    expect(JSON.stringify(mocks.update.mock.calls)).not.toContain("private-provider-token");
    consoleError.mockRestore();
  });

  it("keeps Auth cleanup pending after completing storage cleanup", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.findFirst.mockResolvedValue(deletedUser);
    mocks.removeCourseMaterialFiles.mockResolvedValue(undefined);
    mocks.deleteAuthUser.mockResolvedValue({
      error: { code: "provider_unavailable", message: "private-provider-token" },
    });

    await expect(finalizeAccountDeletionCleanup(deletedUser.id)).resolves.toBe(false);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { deletionStoragePending: false, deletionStoragePaths: [] },
    }));
    expect(mocks.update).not.toHaveBeenCalledWith(expect.objectContaining({
      data: { deletionAuthPending: false },
    }));
    expect(JSON.stringify(mocks.update.mock.calls)).not.toContain("private-provider-token");
    consoleError.mockRestore();
  });

  it("treats an already removed Auth user as complete", async () => {
    mocks.findFirst.mockResolvedValue({
      ...deletedUser,
      deletionStoragePaths: [],
      deletionStoragePending: false,
    });
    mocks.deleteAuthUser.mockResolvedValue({
      error: { code: "user_not_found", message: "User not found" },
    });

    await expect(finalizeAccountDeletionCleanup(deletedUser.id)).resolves.toBe(true);
    expect(mocks.removeCourseMaterialFiles).not.toHaveBeenCalled();
  });
});
