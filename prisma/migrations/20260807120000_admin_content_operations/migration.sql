CREATE TYPE "AdminContentTargetType" AS ENUM ('CATALOG', 'TOPIC', 'MATERIAL');
CREATE TYPE "ContentCorrectionTargetType" AS ENUM ('COURSE', 'TOPIC', 'MATERIAL');
CREATE TYPE "ContentCorrectionStatus" AS ENUM ('SUBMITTED', 'IN_REVIEW', 'RESOLVED', 'REJECTED');

CREATE TABLE "admin_content_audits" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "actor_id" UUID,
  "action" TEXT NOT NULL,
  "target_type" "AdminContentTargetType" NOT NULL,
  "target_id" TEXT NOT NULL,
  "target_label" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_content_audits_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "content_correction_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "course_id" UUID NOT NULL,
  "topic_id" UUID,
  "material_id" UUID,
  "target_type" "ContentCorrectionTargetType" NOT NULL,
  "details" TEXT NOT NULL,
  "status" "ContentCorrectionStatus" NOT NULL DEFAULT 'SUBMITTED',
  "resolution_note" TEXT,
  "reviewed_by_id" UUID,
  "reviewed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "content_correction_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_content_audits_target_type_target_id_created_at_idx" ON "admin_content_audits"("target_type", "target_id", "created_at");
CREATE INDEX "admin_content_audits_actor_id_created_at_idx" ON "admin_content_audits"("actor_id", "created_at");
CREATE INDEX "admin_content_audits_created_at_idx" ON "admin_content_audits"("created_at");
CREATE INDEX "content_correction_requests_status_created_at_idx" ON "content_correction_requests"("status", "created_at");
CREATE INDEX "content_correction_requests_user_id_created_at_idx" ON "content_correction_requests"("user_id", "created_at");
CREATE INDEX "content_correction_requests_course_id_status_idx" ON "content_correction_requests"("course_id", "status");
CREATE INDEX "content_correction_requests_topic_id_idx" ON "content_correction_requests"("topic_id");
CREATE INDEX "content_correction_requests_material_id_idx" ON "content_correction_requests"("material_id");
CREATE INDEX "content_correction_requests_reviewed_by_id_idx" ON "content_correction_requests"("reviewed_by_id");

ALTER TABLE "admin_content_audits" ADD CONSTRAINT "admin_content_audits_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "content_correction_requests" ADD CONSTRAINT "content_correction_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "content_correction_requests" ADD CONSTRAINT "content_correction_requests_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "content_correction_requests" ADD CONSTRAINT "content_correction_requests_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "content_correction_requests" ADD CONSTRAINT "content_correction_requests_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "platform_course_topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "content_correction_requests" ADD CONSTRAINT "content_correction_requests_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "platform_course_materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE FUNCTION prevent_admin_content_audit_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'admin content audit records are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "admin_content_audits_immutable"
BEFORE UPDATE OR DELETE ON "admin_content_audits"
FOR EACH ROW EXECUTE FUNCTION prevent_admin_content_audit_mutation();

ALTER TABLE "admin_content_audits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "content_correction_requests" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "admin_content_audits", "content_correction_requests" FROM anon, authenticated;
