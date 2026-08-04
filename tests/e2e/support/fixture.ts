import { readFile } from "node:fs/promises";
import path from "node:path";

export const fixturePath = path.resolve("test-results", "e2e-fixture.json");

export type TestIdentity = {
  authUserId: string;
  appUserId?: string;
  email: string;
};

export type E2eFixture = {
  runId: string;
  password: string;
  users: {
    primary: TestIdentity;
    onboarding: TestIdentity;
    peer: TestIdentity;
    admin: TestIdentity;
  };
  primarySemesterId: string;
  primaryEnrollmentId: string;
  courseId: string;
  courseName: string;
  diagnosticQuizId: string;
  peerQuestionTitle: string;
  notificationTitle: string;
};

export async function readE2eFixture() {
  return JSON.parse(await readFile(fixturePath, "utf8")) as E2eFixture;
}
