-- AlterTable
ALTER TABLE "users" ADD COLUMN     "active_semester_id" UUID;

-- CreateIndex
CREATE INDEX "users_active_semester_id_idx" ON "users"("active_semester_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_active_semester_id_fkey" FOREIGN KEY ("active_semester_id") REFERENCES "semesters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
