-- BRAIL accesses application data through authenticated server-side Prisma
-- queries. Do not expose public-schema tables directly through Supabase's
-- browser-facing Data API, even if a future server query misses an ownership
-- predicate.

DO $$
DECLARE
  table_record record;
BEGIN
  FOR table_record IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
      table_record.schemaname,
      table_record.tablename
    );
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON TABLE %I.%I FROM anon, authenticated',
      table_record.schemaname,
      table_record.tablename
    );
  END LOOP;
END
$$;

-- Keep new Prisma-managed public tables private by default. The migration
-- owner and direct server database role retain their normal privileges.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon, authenticated;
