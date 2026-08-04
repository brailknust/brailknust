ALTER TABLE "users"
  ADD COLUMN "deletion_storage_paths" JSONB,
  ADD COLUMN "deletion_storage_pending" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "deletion_auth_pending" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "deletion_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "deletion_last_error" TEXT,
  ADD COLUMN "deletion_completed_at" TIMESTAMP(3);

CREATE INDEX "users_deletion_storage_pending_deletion_auth_pending_idx"
  ON "users"("deletion_storage_pending", "deletion_auth_pending");
