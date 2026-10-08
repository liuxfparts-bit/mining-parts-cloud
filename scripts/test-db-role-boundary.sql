\set ON_ERROR_STOP on
-- CI/disposable PostgreSQL ONLY. All role/GRANT changes rolled back.
BEGIN;
CREATE ROLE ci_kpy_runtime_boundary NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
GRANT USAGE ON SCHEMA public TO ci_kpy_runtime_boundary;
DO $body$
DECLARE obj record;
BEGIN
  FOR obj IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN ('EvidenceSource','EvidenceItem','EvidenceReviewEvent') LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO ci_kpy_runtime_boundary', obj.tablename);
  END LOOP;
  FOR obj IN SELECT sequencename FROM pg_sequences WHERE schemaname='public' LOOP
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE public.%I TO ci_kpy_runtime_boundary', obj.sequencename);
  END LOOP;
END
$body$;
GRANT SELECT, INSERT ON TABLE "EvidenceSource", "EvidenceItem", "EvidenceReviewEvent" TO ci_kpy_runtime_boundary;
-- Test actor is a member only for this rollback-only test transaction.
GRANT ci_kpy_runtime_boundary TO CURRENT_USER;
SET ROLE ci_kpy_runtime_boundary;
DO $checks$
DECLARE
  role_ok boolean;
  tbl text;
  denied boolean;
BEGIN
  SELECT NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolbypassrls INTO role_ok
    FROM pg_roles WHERE rolname = current_user;
  IF NOT role_ok THEN RAISE EXCEPTION 'FAIL: runtime elevated role'; END IF;
  IF has_schema_privilege(current_user,'public','CREATE') THEN RAISE EXCEPTION 'FAIL: schema CREATE'; END IF;
  IF NOT has_schema_privilege(current_user,'public','USAGE') THEN RAISE EXCEPTION 'FAIL: schema USAGE'; END IF;
  FOREACH tbl IN ARRAY ARRAY['EvidenceSource','EvidenceItem','EvidenceReviewEvent'] LOOP
    IF NOT has_table_privilege(current_user,format('public.%I',tbl),'SELECT') OR NOT has_table_privilege(current_user,format('public.%I',tbl),'INSERT') THEN RAISE EXCEPTION 'FAIL: missing evidence SELECT/INSERT: %',tbl; END IF;
    IF has_table_privilege(current_user,format('public.%I',tbl),'UPDATE') OR has_table_privilege(current_user,format('public.%I',tbl),'DELETE') OR has_table_privilege(current_user,format('public.%I',tbl),'TRUNCATE') THEN RAISE EXCEPTION 'FAIL: evidence mutation privilege: %',tbl; END IF;
  END LOOP;
  BEGIN EXECUTE 'CREATE TABLE public.ci_privilege_escape (id int)'; RAISE EXCEPTION 'FAIL: CREATE TABLE permitted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN EXECUTE 'ALTER TABLE public."EvidenceSource" DISABLE TRIGGER ALL'; RAISE EXCEPTION 'FAIL: disable trigger permitted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN EXECUTE 'TRUNCATE public."EvidenceSource"'; RAISE EXCEPTION 'FAIL: TRUNCATE permitted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN EXECUTE 'DELETE FROM public."EvidenceSource"'; RAISE EXCEPTION 'FAIL: DELETE permitted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RAISE NOTICE 'ROLE_BOUNDARY_TESTS=PASS';
END
$checks$;
RESET ROLE;
ROLLBACK;
-- Confirm no test role persisted after rollback.
SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname='ci_kpy_runtime_boundary') THEN 'FAIL: leaked role' ELSE 'ROLE_BOUNDARY_ROLLBACK=PASS' END AS result;
