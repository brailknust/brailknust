CREATE TABLE "peer_questions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "semester_id" UUID NOT NULL,
    "course_id" UUID,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "peer_questions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "peer_answers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "question_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "peer_answers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "peer_question_votes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "question_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "peer_question_votes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "peer_questions_semester_id_created_at_idx" ON "peer_questions"("semester_id", "created_at");
CREATE INDEX "peer_questions_course_id_idx" ON "peer_questions"("course_id");
CREATE INDEX "peer_questions_user_id_idx" ON "peer_questions"("user_id");
CREATE INDEX "peer_answers_question_id_created_at_idx" ON "peer_answers"("question_id", "created_at");
CREATE INDEX "peer_answers_user_id_idx" ON "peer_answers"("user_id");
CREATE UNIQUE INDEX "peer_question_votes_question_id_user_id_key" ON "peer_question_votes"("question_id", "user_id");
CREATE INDEX "peer_question_votes_user_id_idx" ON "peer_question_votes"("user_id");

ALTER TABLE "peer_questions" ADD CONSTRAINT "peer_questions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "peer_questions" ADD CONSTRAINT "peer_questions_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "peer_questions" ADD CONSTRAINT "peer_questions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "peer_answers" ADD CONSTRAINT "peer_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "peer_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "peer_answers" ADD CONSTRAINT "peer_answers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "peer_question_votes" ADD CONSTRAINT "peer_question_votes_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "peer_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "peer_question_votes" ADD CONSTRAINT "peer_question_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
