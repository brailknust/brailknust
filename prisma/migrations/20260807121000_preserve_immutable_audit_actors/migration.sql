ALTER TABLE "admin_content_audits" DROP CONSTRAINT "admin_content_audits_actor_id_fkey";
ALTER TABLE "admin_content_audits" ALTER COLUMN "actor_id" SET NOT NULL;
