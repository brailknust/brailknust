ALTER TABLE "semesters" ADD COLUMN "is_archived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "semesters" ADD COLUMN "archived_at" TIMESTAMP(3);

CREATE INDEX "semesters_owner_id_is_archived_idx" ON "semesters"("owner_id", "is_archived");

CREATE TABLE "goal_progress_snapshots" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "semester_id" UUID NOT NULL,
  "goal_id" UUID NOT NULL,
  "metric" "GoalMetric" NOT NULL,
  "current_value" DECIMAL(10,2) NOT NULL,
  "target_value" DECIMAL(10,2) NOT NULL,
  "progress" INTEGER NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'computed',
  "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "goal_progress_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "goal_progress_snapshots_goal_id_recorded_at_idx"
  ON "goal_progress_snapshots"("goal_id", "recorded_at");

CREATE INDEX "goal_progress_snapshots_user_id_semester_id_recorded_at_idx"
  ON "goal_progress_snapshots"("user_id", "semester_id", "recorded_at");

ALTER TABLE "goal_progress_snapshots"
  ADD CONSTRAINT "goal_progress_snapshots_goal_id_fkey"
  FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "goal_progress_snapshots"
  ADD CONSTRAINT "goal_progress_snapshots_semester_id_fkey"
  FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "goal_progress_snapshots"
  ADD CONSTRAINT "goal_progress_snapshots_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
