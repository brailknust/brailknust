CREATE TYPE "DiagnosticStatus" AS ENUM ('READY', 'IN_PROGRESS', 'COMPLETED');
CREATE TYPE "QuestionDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

CREATE TABLE "diagnostic_quizzes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "enrollment_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "status" "DiagnosticStatus" NOT NULL DEFAULT 'READY',
  "blueprint" JSONB NOT NULL,
  "score" INTEGER,
  "max_score" INTEGER,
  "model" TEXT,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "diagnostic_quizzes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "diagnostic_questions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "quiz_id" UUID NOT NULL,
  "topic_id" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  "prompt" TEXT NOT NULL,
  "options" JSONB NOT NULL,
  "correct_answer" TEXT NOT NULL,
  "explanation" TEXT NOT NULL,
  "difficulty" "QuestionDifficulty" NOT NULL DEFAULT 'MEDIUM',
  "source_refs" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "diagnostic_questions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "diagnostic_attempts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "question_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "selected_answer" TEXT NOT NULL,
  "is_correct" BOOLEAN NOT NULL,
  "answered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "diagnostic_attempts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "topic_masteries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "enrollment_id" UUID NOT NULL,
  "topic_id" UUID NOT NULL,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "correct_count" INTEGER NOT NULL DEFAULT 0,
  "mastery_score" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "topic_masteries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "diagnostic_quizzes_user_id_created_at_idx" ON "diagnostic_quizzes"("user_id", "created_at");
CREATE INDEX "diagnostic_quizzes_enrollment_id_status_idx" ON "diagnostic_quizzes"("enrollment_id", "status");
CREATE UNIQUE INDEX "diagnostic_questions_quiz_id_position_key" ON "diagnostic_questions"("quiz_id", "position");
CREATE INDEX "diagnostic_questions_topic_id_idx" ON "diagnostic_questions"("topic_id");
CREATE UNIQUE INDEX "diagnostic_attempts_question_id_user_id_key" ON "diagnostic_attempts"("question_id", "user_id");
CREATE INDEX "diagnostic_attempts_user_id_answered_at_idx" ON "diagnostic_attempts"("user_id", "answered_at");
CREATE UNIQUE INDEX "topic_masteries_user_id_enrollment_id_topic_id_key" ON "topic_masteries"("user_id", "enrollment_id", "topic_id");
CREATE INDEX "topic_masteries_enrollment_id_mastery_score_idx" ON "topic_masteries"("enrollment_id", "mastery_score");

ALTER TABLE "diagnostic_quizzes" ADD CONSTRAINT "diagnostic_quizzes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "diagnostic_quizzes" ADD CONSTRAINT "diagnostic_quizzes_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "diagnostic_questions" ADD CONSTRAINT "diagnostic_questions_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "diagnostic_quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "diagnostic_questions" ADD CONSTRAINT "diagnostic_questions_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "course_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "diagnostic_attempts" ADD CONSTRAINT "diagnostic_attempts_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "diagnostic_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "diagnostic_attempts" ADD CONSTRAINT "diagnostic_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "topic_masteries" ADD CONSTRAINT "topic_masteries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "topic_masteries" ADD CONSTRAINT "topic_masteries_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "topic_masteries" ADD CONSTRAINT "topic_masteries_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "course_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
