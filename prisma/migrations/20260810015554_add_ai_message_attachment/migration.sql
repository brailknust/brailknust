-- AlterTable
ALTER TABLE "ai_messages" ADD COLUMN     "attached_material_id" UUID;

-- CreateIndex
CREATE INDEX "ai_messages_attached_material_id_idx" ON "ai_messages"("attached_material_id");

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_attached_material_id_fkey" FOREIGN KEY ("attached_material_id") REFERENCES "course_materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;
