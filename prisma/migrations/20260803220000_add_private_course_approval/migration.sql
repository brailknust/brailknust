CREATE TYPE "CourseApprovalStatus" AS ENUM ('OFFICIAL', 'PENDING', 'REJECTED');

ALTER TABLE "courses"
  ADD COLUMN "approval_status" "CourseApprovalStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "created_by_id" UUID;

-- Every course predating this workflow came from the shared catalogue or an
-- administrator-managed import and remains available to all students.
UPDATE "courses" SET "approval_status" = 'OFFICIAL';

CREATE INDEX "courses_approval_status_created_by_id_idx"
  ON "courses"("approval_status", "created_by_id");

ALTER TABLE "courses"
  ADD CONSTRAINT "courses_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
