ALTER TABLE "study_groups"
ADD COLUMN "description" TEXT,
ADD COLUMN "semester_id" UUID NOT NULL,
ADD COLUMN "meeting_at" TIMESTAMP(3),
ADD COLUMN "meeting_place" TEXT,
ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL;

DROP INDEX "study_groups_course_id_idx";

CREATE INDEX "study_groups_semester_id_course_id_idx" ON "study_groups"("semester_id", "course_id");
CREATE INDEX "study_groups_owner_id_idx" ON "study_groups"("owner_id");

ALTER TABLE "study_groups"
ADD CONSTRAINT "study_groups_semester_id_fkey"
FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
