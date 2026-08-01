-- CreateTable
CREATE TABLE "semester_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "semester_id" UUID NOT NULL,
    "cwa" DECIMAL(5,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "semester_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "semester_profiles_semester_id_idx" ON "semester_profiles"("semester_id");

-- CreateIndex
CREATE UNIQUE INDEX "semester_profiles_user_id_semester_id_key" ON "semester_profiles"("user_id", "semester_id");

-- AddForeignKey
ALTER TABLE "semester_profiles" ADD CONSTRAINT "semester_profiles_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semester_profiles" ADD CONSTRAINT "semester_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
