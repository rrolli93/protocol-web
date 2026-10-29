-- Optional check for a local Supabase database after 20261029_dare_mvp.sql.
-- CI asserts the same rules by reading the migration. This script raises if
-- the grants that would let a logged-in user write fundings or read every proof
-- are still present.
DO $$
DECLARE
  funding_insert boolean;
  proof_public boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name = 'fundings'
      AND grantee IN ('anon', 'authenticated')
      AND privilege_type = 'INSERT'
  ) INTO funding_insert;

  IF funding_insert THEN
    RAISE EXCEPTION 'authenticated or anon can INSERT fundings';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'proofs'
      AND cmd = 'SELECT'
      AND qual = 'true'
  ) INTO proof_public;

  IF proof_public THEN
    RAISE EXCEPTION 'proofs SELECT policy is open to everyone';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'proofs' AND policyname = 'proofs_select'
  ) THEN
    RAISE EXCEPTION 'proofs_select policy is missing';
  END IF;
END $$;
