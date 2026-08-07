-- The attendance/study-tracking (20260805230000_attendance_study_tracking)
-- and goal-progress-snapshot (20260805170000_archive_semesters_and_goal_progress)
-- migrations created these tables without enabling row level security or
-- revoking Supabase browser-role privileges, unlike every other
-- Prisma-managed public table (see 20260803193000_lock_down_public_data_api).
-- BRAIL accesses application data through authenticated server-side Prisma
-- queries only; keep these tables private by default as well.

ALTER TABLE "attendance_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "study_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cwa_evidence_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "goal_progress_snapshots" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE
  "attendance_records",
  "study_sessions",
  "cwa_evidence_records",
  "goal_progress_snapshots"
FROM anon, authenticated;
