CREATE TYPE "AiUsageOperation" AS ENUM ('CHAT', 'DIAGNOSTIC');

CREATE TABLE "ai_usage_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "semester_id" UUID,
  "operation" "AiUsageOperation" NOT NULL,
  "model" TEXT NOT NULL,
  "prompt_tokens" INTEGER NOT NULL DEFAULT 0,
  "completion_tokens" INTEGER NOT NULL DEFAULT 0,
  "total_tokens" INTEGER NOT NULL DEFAULT 0,
  "latency_ms" INTEGER,
  "estimated_cost_micros" INTEGER NOT NULL DEFAULT 0,
  "succeeded" BOOLEAN NOT NULL DEFAULT true,
  "failure_code" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ai_usage_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_usage_events_user_id_created_at_idx"
  ON "ai_usage_events"("user_id", "created_at");
CREATE INDEX "ai_usage_events_operation_created_at_idx"
  ON "ai_usage_events"("operation", "created_at");
CREATE INDEX "ai_usage_events_created_at_idx"
  ON "ai_usage_events"("created_at");

ALTER TABLE "ai_usage_events"
  ADD CONSTRAINT "ai_usage_events_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_usage_events"
  ADD CONSTRAINT "ai_usage_events_semester_id_fkey"
  FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ai_usage_events" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "ai_usage_events" FROM anon, authenticated;
