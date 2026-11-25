-- REVIEW ONLY: #399. Isolated disposable STAGING database only.
-- Do not execute on production. Not a migration or deployment input.
-- Verify staging project identity and take a backup outside this script.
-- This rehearsal deliberately ends with ROLLBACK; no persistent change.
-- Live audit 2026-11-23: direct authenticated grants on six RLS tables
-- include TRUNCATE, TRIGGER, REFERENCES; no inherited role grants observed.
-- Both postgres and supabase_admin public default ACLs grant ALL to app roles.
-- Default ACL remediation is intentionally separate: changing managed owner
-- defaults or anon privileges needs application/managed-platform review.
BEGIN;
CREATE TEMP TABLE qa_399_before ON COMMIT DROP AS
SELECT c.oid AS relid, role_name, privilege,
       has_table_privilege(role_name, c.oid, privilege) AS granted
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
CROSS JOIN (VALUES ('anon'),('authenticated'),('service_role'),('postgres')) r(role_name)
CROSS JOIN (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE'),
                   ('TRUNCATE'),('TRIGGER'),('REFERENCES')) p(privilege)
WHERE n.nspname='public' AND c.relname IN (
'document_translations', 'news_article_topics', 'news_articles', 'news_historical_connections', 'news_narrative_analyses', 'news_watch_topics'
) AND c.relkind IN ('r','p') AND c.relrowsecurity;

DO $qa$
BEGIN
  IF (SELECT count(DISTINCT relid) FROM qa_399_before) <> 6 THEN
    RAISE EXCEPTION 'QA #399: expected six RLS-enabled staging tables';
  END IF;
  IF (SELECT count(*) FROM qa_399_before WHERE role_name='authenticated'
      AND privilege IN ('TRUNCATE','TRIGGER','REFERENCES') AND granted) <> 18 THEN
    RAISE EXCEPTION 'QA #399: staging privileges differ from audited baseline; review drift';
  END IF;
END
$qa$;

REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLE
  public.document_translations,
  public.news_article_topics,
  public.news_articles,
  public.news_historical_connections,
  public.news_narrative_analyses,
  public.news_watch_topics
FROM authenticated;

DO $qa$
BEGIN
  IF EXISTS (
    SELECT 1 FROM qa_399_before b
    WHERE has_table_privilege(b.role_name,b.relid,b.privilege)
      IS DISTINCT FROM
      CASE WHEN b.role_name='authenticated'
             AND b.privilege IN ('TRUNCATE','TRIGGER','REFERENCES')
           THEN false ELSE b.granted END
  ) THEN
    RAISE EXCEPTION 'QA #399: unexpected effective privilege change or residual inherited grant';
  END IF;
END
$qa$;

-- Report only, not a grant change: inspect default privileges for future tables.
SELECT pg_get_userbyid(d.defaclrole) AS creator, n.nspname AS schema_name,
       d.defaclacl::text AS default_acl
FROM pg_default_acl d JOIN pg_namespace n ON n.oid=d.defaclnamespace
WHERE n.nspname='public' AND d.defaclobjtype='r';

-- No TRUNCATE, CREATE TRIGGER, or application writes are tested here.
-- After review: independent staging REST/editor CRUD and RLS regression
-- tests are required, including combined #356 and #396 policy changes.
-- Separately decide whether to narrow postgres and supabase_admin defaults;
-- do not assume permission to alter platform-managed role defaults.
-- If a separately approved persistent patch ever needs reversal, the
-- audited direct-grant restoration is GRANT TRUNCATE, TRIGGER, REFERENCES
-- ON the same six tables TO authenticated; re-check drift before doing so.
ROLLBACK;
