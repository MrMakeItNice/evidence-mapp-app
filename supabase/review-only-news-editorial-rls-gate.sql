-- EVIDENCE ATLAS — REVIEW ONLY / STAGING FIRST
-- This is a proposed, manually applied policy change. Committing or merging
-- this file must NOT execute it automatically. Do not run against production
-- without explicit owner review, a staging test, and a rollback plan.
--
-- Findings at 2026-11-22 12:10 UTC: actual PostgreSQL anon role can SELECT
-- 17 published-but-pending news articles and 4 proposed connections.
-- The existing CHECK constraints allow review_status:
--   news_articles: pending | reviewed | rejected
--   news_historical_connections: proposed | reviewed | rejected
-- Hence 'reviewed' is the explicit approval state; 'approved' is NOT valid.
--
-- Existing named policies are changed in place, preserving owner write rules.
-- Existing news-only publication flag is not equivalent to editorial review.
BEGIN;
SET LOCAL lock_timeout = '2s';

ALTER POLICY "public reads published news"
  ON public.news_articles
  USING (
    published IS TRUE
    AND review_status = 'reviewed'
  );

ALTER POLICY "public reads links for published news"
  ON public.news_historical_connections
  USING (
    review_status = 'reviewed'
    AND EXISTS (
      SELECT 1
      FROM public.news_articles AS a
      WHERE a.id = news_historical_connections.article_id
        AND a.published IS TRUE
        AND a.review_status = 'reviewed'
    )
  );

COMMIT;

-- Staging verification should run as the actual anon role, not service_role.
-- Use a separate READ ONLY transaction after applying these policy changes:
--
-- BEGIN READ ONLY;
-- SET LOCAL ROLE anon;
-- SELECT count(*) FROM public.news_articles
--   WHERE published IS TRUE AND review_status <> 'reviewed'; -- expect 0
-- SELECT count(*) FROM public.news_historical_connections
--   WHERE review_status <> 'reviewed'; -- expect 0
-- ROLLBACK;
--
-- Also seed staged reviewed + pending examples and confirm the reviewed
-- article/link are visible while the pending/proposed examples are not.
-- Reconfirm permissions as the authenticated owner.
--
-- Manual rollback if authorized:
-- ALTER POLICY "public reads published news" ON public.news_articles
--   USING (published = true AND review_status <> 'rejected');
-- ALTER POLICY "public reads links for published news"
--   ON public.news_historical_connections
--   USING (review_status <> 'rejected'
--     AND EXISTS (SELECT 1 FROM public.news_articles AS a
--       WHERE a.id = news_historical_connections.article_id
--       AND a.published = true AND a.review_status <> 'rejected'));
-- WARNING: rollback restores the demonstrated exposure; do not deploy rollback
-- to production without explicit incident-handling authorization.
