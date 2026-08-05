CREATE TYPE "AdminRoleAction" AS ENUM ('BOOTSTRAPPED', 'GRANTED', 'REVOKED');

CREATE TABLE "admin_role_audits" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "actor_id" UUID,
  "target_user_id" UUID NOT NULL,
  "action" "AdminRoleAction" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_role_audits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_role_audits_target_user_id_created_at_idx"
  ON "admin_role_audits"("target_user_id", "created_at");
CREATE INDEX "admin_role_audits_actor_id_idx" ON "admin_role_audits"("actor_id");

ALTER TABLE "admin_role_audits"
  ADD CONSTRAINT "admin_role_audits_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "admin_role_audits"
  ADD CONSTRAINT "admin_role_audits_target_user_id_fkey"
  FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "admin_role_audits" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "admin_role_audits" FROM anon, authenticated;
