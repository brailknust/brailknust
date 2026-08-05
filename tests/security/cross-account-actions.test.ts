import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const prisma = {
    $transaction: vi.fn(),
    aiConversation: { deleteMany: vi.fn() },
    assessment: { deleteMany: vi.fn() },
    courseMaterial: { delete: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    diagnosticQuiz: { findFirst: vi.fn() },
    enrollment: { deleteMany: vi.fn(), findFirst: vi.fn() },
    goal: { deleteMany: vi.fn() },
    notification: { deleteMany: vi.fn(), updateMany: vi.fn() },
    peerQuestion: { deleteMany: vi.fn() },
    semester: { findFirst: vi.fn() },
    studyGroup: { deleteMany: vi.fn() },
    studyPlanItem: { deleteMany: vi.fn() },
    task: { delete: vi.fn(), findFirst: vi.fn() },
  };
  return {
    prisma,
    requireAppUser: vi.fn(),
    revalidatePath: vi.fn(),
    redirect: vi.fn(),
    removeCourseMaterialFile: vi.fn(),
    downloadCourseMaterialFile: vi.fn(),
    syncNotificationsForUser: vi.fn(),
  };
});

vi.mock("@/server/db", () => ({ prisma: mocks.prisma }));
vi.mock("@/features/auth/queries", () => ({ requireAppUser: mocks.requireAppUser }));
vi.mock("@/features/materials/storage", () => ({
  downloadCourseMaterialFile: mocks.downloadCourseMaterialFile,
  removeCourseMaterialFile: mocks.removeCourseMaterialFile,
}));
vi.mock("@/features/notifications/service", () => ({
  syncNotificationsForUser: mocks.syncNotificationsForUser,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { deleteEnrollment } from "@/features/academics/actions";
import { deleteAiConversation } from "@/features/ai/actions";
import { deleteAssessment } from "@/features/assessments/actions";
import { submitDiagnosticQuiz } from "@/features/diagnostics/actions";
import { deleteGoal } from "@/features/goals/actions";
import { deleteCourseMaterial, retryCourseMaterialProcessing } from "@/features/materials/actions";
import { deleteNotification } from "@/features/notifications/actions";
import { deletePeerQuestion, deleteStudyGroup } from "@/features/peers/actions";
import { deleteStudyPlanItem } from "@/features/planner/actions";
import { deleteTask } from "@/features/tasks/actions";

const currentUserId = "00000000-0000-4000-8000-000000000002";
const currentSemesterId = "00000000-0000-4000-8000-000000000012";
const foreignId = "00000000-0000-4000-8000-000000000099";
const courseId = "00000000-0000-4000-8000-000000000020";

function form(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

describe("cross-account mutation boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAppUser.mockResolvedValue({
      authUser: { id: "auth-user-b" },
      appUser: { id: currentUserId, activeSemesterId: currentSemesterId },
    });
    mocks.prisma.semester.findFirst.mockResolvedValue({ id: currentSemesterId, isArchived: false });
    mocks.prisma.$transaction.mockImplementation(async (queries: unknown[]) => Promise.all(queries));
  });

  it("scopes enrollment deletion to the signed-in user", async () => {
    mocks.prisma.enrollment.findFirst.mockResolvedValue(null);
    mocks.prisma.enrollment.deleteMany.mockResolvedValue({ count: 0 });
    await deleteEnrollment(form({ enrollmentId: foreignId, semesterId: currentSemesterId }));
    expect(mocks.prisma.enrollment.deleteMany).toHaveBeenCalledWith({
      where: { id: foreignId, userId: currentUserId, semesterId: currentSemesterId },
    });
  });

  it("does not delete a foreign task", async () => {
    mocks.prisma.task.findFirst.mockResolvedValue(null);
    await deleteTask(form({ id: foreignId }));
    expect(mocks.prisma.task.findFirst).toHaveBeenCalledWith({
      where: { id: foreignId, userId: currentUserId, semesterId: currentSemesterId },
      select: { courseId: true },
    });
    expect(mocks.prisma.task.delete).not.toHaveBeenCalled();
  });

  it("scopes assessments and goals to the signed-in user", async () => {
    mocks.prisma.assessment.deleteMany.mockResolvedValue({ count: 0 });
    mocks.prisma.goal.deleteMany.mockResolvedValue({ count: 0 });
    await deleteAssessment(form({ id: foreignId, semesterId: currentSemesterId, courseId }));
    await deleteGoal(form({ id: foreignId }));
    expect(mocks.prisma.assessment.deleteMany).toHaveBeenCalledWith({
      where: { id: foreignId, userId: currentUserId, semesterId: currentSemesterId, courseId },
    });
    expect(mocks.prisma.goal.deleteMany).toHaveBeenCalledWith({
      where: { id: foreignId, userId: currentUserId, semesterId: currentSemesterId },
    });
  });

  it("scopes conversations and notifications to the signed-in user", async () => {
    mocks.prisma.aiConversation.deleteMany.mockResolvedValue({ count: 0 });
    mocks.prisma.notification.updateMany.mockResolvedValue({ count: 0 });
    await deleteAiConversation(form({ conversationId: foreignId }));
    await deleteNotification(form({ id: foreignId }));
    expect(mocks.prisma.aiConversation.deleteMany).toHaveBeenCalledWith({
      where: {
        id: foreignId,
        userId: currentUserId,
        semesterId: currentSemesterId,
        isPinned: false,
      },
    });
    expect(mocks.prisma.notification.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: foreignId, userId: currentUserId },
    }));
  });

  it("does not delete another user's private material", async () => {
    mocks.prisma.courseMaterial.findFirst.mockResolvedValue(null);
    await deleteCourseMaterial(form({ materialId: foreignId, semesterId: currentSemesterId, courseId }));
    expect(mocks.prisma.courseMaterial.findFirst).toHaveBeenCalledWith({
      where: {
        id: foreignId,
        uploadedBy: currentUserId,
        enrollment: { userId: currentUserId, semesterId: currentSemesterId, courseId },
      },
      select: { id: true, storagePath: true },
    });
    expect(mocks.prisma.courseMaterial.delete).not.toHaveBeenCalled();
  });

  it("does not retry another user's failed material", async () => {
    mocks.prisma.courseMaterial.findFirst.mockResolvedValue(null);
    await expect(retryCourseMaterialProcessing(form({
      materialId: foreignId,
      semesterId: currentSemesterId,
      courseId,
    }))).rejects.toThrow("Failed material not found");
    expect(mocks.prisma.courseMaterial.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: foreignId,
        uploadedBy: currentUserId,
        status: "FAILED",
        enrollment: { userId: currentUserId, semesterId: currentSemesterId, courseId },
      }),
    }));
    expect(mocks.downloadCourseMaterialFile).not.toHaveBeenCalled();
  });

  it("scopes study sessions through the user's active plan", async () => {
    mocks.prisma.studyPlanItem.deleteMany.mockResolvedValue({ count: 0 });
    mocks.prisma.notification.deleteMany.mockResolvedValue({ count: 0 });
    await expect(deleteStudyPlanItem(form({
      id: foreignId,
      studyPlanId: "00000000-0000-4000-8000-000000000030",
      dayOfWeek: "1",
    }))).rejects.toThrow("Study session not found");
    expect(mocks.prisma.studyPlanItem.deleteMany).toHaveBeenCalledWith({
      where: {
        id: foreignId,
        studyPlanId: "00000000-0000-4000-8000-000000000030",
        studyPlan: { userId: currentUserId, semesterId: currentSemesterId },
      },
    });
  });

  it("scopes groups and peer questions to their owner", async () => {
    mocks.prisma.studyGroup.deleteMany.mockResolvedValue({ count: 0 });
    mocks.prisma.peerQuestion.deleteMany.mockResolvedValue({ count: 0 });
    await deleteStudyGroup(form({ groupId: foreignId }));
    await deletePeerQuestion(form({ questionId: foreignId }));
    expect(mocks.prisma.studyGroup.deleteMany).toHaveBeenCalledWith({
      where: { id: foreignId, ownerId: currentUserId, semesterId: currentSemesterId },
    });
    expect(mocks.prisma.peerQuestion.deleteMany).toHaveBeenCalledWith({
      where: { id: foreignId, userId: currentUserId, semesterId: currentSemesterId },
    });
  });

  it("rejects another user's diagnostic quiz", async () => {
    mocks.prisma.diagnosticQuiz.findFirst.mockResolvedValue(null);
    await expect(submitDiagnosticQuiz(form({ quizId: foreignId }))).rejects.toThrow("Diagnostic quiz not found");
    expect(mocks.prisma.diagnosticQuiz.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: foreignId, userId: currentUserId },
    }));
  });
});
