-- EVIDENCE ATLAS — REVIEW-ONLY / STAGING-FIRST RLS PATCH
-- GitHub issue #395. Committing this file does NOT apply SQL.
-- DO NOT execute on production, merge, or deploy without explicit owner approval.
--
-- Live read-only reproduction (2026-11-23):
--   anon:          140 published cases, 123 published sources
--   authenticated non-owner: 0 published cases, 0 published sources
-- Existing SELECT policies are not only permissive. The restrictive
-- min_owner_read_guard on each table also limits published rows to
-- CURRENT_USER = 'anon'. Merely extending the permissive public policy
-- to authenticated would NOT fix the issue.
--
-- These statements must be manually trialed on STAGING only, with a backup,
-- staging reader accounts, and an approved rollback plan.
--
-- Scope: SELECT on published cases and sources only. No INSERT/UPDATE/DELETE
-- policies, claims, relationships, source publication flags, or editorial
-- statuses are changed. An owner may still read drafts through min_owner_allow.
BEGIN;
SET LOCAL lock_timeout = '2s';

-- Permissive policy: published records are intentionally public, regardless
-- of whether the request uses an anonymous or signed-in Supabase JWT.
ALTER POLICY "public reads published cases"
  ON public.cases TO anon, authenticated
  USING (published IS TRUE);

-- Restrictive SELECT guard: do not accidentally keep blocking authenticated
-- published rows; continue to deny drafts to all non-owner identities.
ALTER POLICY "min_owner_read_guard"
  ON public.cases TO anon, authenticated
  USING (
    (SELECT auth.uid()) = 'cdfff424-d750-4f82-baa3-d17a6113af53'::uuid
    OR published IS TRUE
  );

ALTER POLICY "public reads published sources"
  ON public.sources TO anon, authenticated
  USING (published IS TRUE);

ALTER POLICY "min_owner_read_guard"
  ON public.sources TO anon, authenticated
  USING (
    (SELECT auth.uid()) = 'cdfff424-d750-4f82-baa3-d17a6113af53'::uuid
    OR published IS TRUE
  );

COMMIT;

-- REQUIRED STAGING TESTS (run separately, in READ ONLY transactions):
-- 1. Confirm the existing policies on both tables match the audited baseline
--    BEFORE applying this patch; review any drift in pg_policies.
-- 2. With actual anon role:
--      BEGIN READ ONLY; SET LOCAL ROLE anon;
--      SELECT count(*) FROM public.cases WHERE published IS TRUE;
--      SELECT count(*) FROM public.sources WHERE published IS TRUE;
--      SELECT count(*) FROM public.cases WHERE published IS DISTINCT FROM TRUE;
--      SELECT count(*) FROM public.sources WHERE published IS DISTINCT FROM TRUE;
--      ROLLBACK;
--    Expected: all staged published rows visible; unpublished counts = 0.
-- 3. With an authenticated NON-OWNER JWT:
--      BEGIN READ ONLY; SET LOCAL ROLE authenticated;
--      SELECT set_config('request.jwt.claim.sub',
--        '00000000-0000-4000-8000-000000000123', true);
--      SELECT count(*) FROM public.cases WHERE published IS TRUE;
--      SELECT count(*) FROM public.sources WHERE published IS TRUE;
--      SELECT count(*) FROM public.cases WHERE published IS DISTINCT FROM TRUE;
--      SELECT count(*) FROM public.sources WHERE published IS DISTINCT FROM TRUE;
--      ROLLBACK;
--    Expected: same published counts as anon; no draft rows.
-- 4. With authenticated OWNER JWT in staging: owner must still read drafts.
-- 5. Use actual signed-in and anonymous Supabase REST clients, not only SQL,
--    to verify both SELECT access and absence of non-owner write access.
-- 6. Recheck claims (issue #43), source metadata (#325), news editorial
--    policies (#106/#273/#356), and citation filtering (#341/#342) separately.
--    This patch does not make a published source adequately evidenced.
--
-- MANUAL STAGING ROLLBACK ONLY (DO NOT execute automatically):
-- BEGIN;
-- ALTER POLICY "public reads published cases" ON public.cases
--   TO anon USING (published IS TRUE);
-- ALTER POLICY "min_owner_read_guard" ON public.cases
--   TO anon, authenticated
--   USING ((SELECT auth.uid()) =
--     'cdfff424-d750-4f82-baa3-d17a6113af53'::uuid
--     OR (CURRENT_USER = 'anon' AND published IS TRUE));
-- ALTER POLICY "public reads published sources" ON public.sources
--   TO anon USING (published IS TRUE);
-- ALTER POLICY "min_owner_read_guard" ON public.sources
--   TO anon, authenticated
--   USING ((SELECT auth.uid()) =
--     'cdfff424-d750-4f82-baa3-d17a6113af53'::uuid
--     OR (CURRENT_USER = 'anon' AND published IS TRUE));
-- COMMIT;
-- WARNING: rollback reintroduces the signed-in reader access defect.
