\set ON_ERROR_STOP on
-- Disposable CI database only. No persistent grants, data or roles.
BEGIN;
CREATE ROLE ci_kpy_runtime_compat NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE ci_kpy_migrator_compat NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
GRANT USAGE ON SCHEMA public TO ci_kpy_runtime_compat;
GRANT USAGE, CREATE ON SCHEMA public TO ci_kpy_migrator_compat;
DO $grant$
DECLARE obj record;
BEGIN
  FOR obj IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN ('EvidenceSource','EvidenceItem','EvidenceReviewEvent') LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO ci_kpy_runtime_compat',obj.tablename);
  END LOOP;
  FOR obj IN SELECT sequencename FROM pg_sequences WHERE schemaname='public' LOOP
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE public.%I TO ci_kpy_runtime_compat',obj.sequencename);
  END LOOP;
END
$grant$;
GRANT SELECT, INSERT ON "EvidenceSource", "EvidenceItem", "EvidenceReviewEvent" TO ci_kpy_runtime_compat;
GRANT ci_kpy_runtime_compat, ci_kpy_migrator_compat TO CURRENT_USER;
SET ROLE ci_kpy_runtime_compat;
DO $checks$
DECLARE obj record; n integer := 0;
BEGIN
  IF pg_has_role(current_user,'ci_kpy_migrator_compat','MEMBER') THEN RAISE EXCEPTION 'FAIL: runtime inherits migrator'; END IF;
  FOR obj IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    IF NOT has_table_privilege(current_user,format('public.%I',obj.tablename),'SELECT') THEN RAISE EXCEPTION 'FAIL: runtime SELECT %',obj.tablename; END IF;
    EXECUTE format('SELECT count(*) FROM (SELECT 1 FROM public.%I LIMIT 0) s',obj.tablename);
    IF obj.tablename NOT IN ('EvidenceSource','EvidenceItem','EvidenceReviewEvent') AND
       (NOT has_table_privilege(current_user,format('public.%I',obj.tablename),'INSERT') OR
        NOT has_table_privilege(current_user,format('public.%I',obj.tablename),'UPDATE') OR
        NOT has_table_privilege(current_user,format('public.%I',obj.tablename),'DELETE')) THEN
       RAISE EXCEPTION 'FAIL: existing business CRUD privileges %',obj.tablename;
    END IF;
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'RUNTIME_ALL_TABLE_SELECT_PASS tables=%',n;
END
$checks$;
-- Actual CRUD under runtime identity; the enclosing transaction rolls everything back.
WITH created AS (
  INSERT INTO public."Brand" (slug, name, "updatedAt")
  VALUES ('ci-role-compat-brand', 'CI Role Compatibility', CURRENT_TIMESTAMP)
  RETURNING id
)
SELECT id AS runtime_inserted_brand_id FROM created;
UPDATE public."Brand" SET "nameEn"='CI role update'
WHERE slug='ci-role-compat-brand';
DO $checks$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public."Brand" WHERE slug='ci-role-compat-brand' AND "nameEn"='CI role update') THEN
    RAISE EXCEPTION 'FAIL: runtime insert/update/read roundtrip';
  END IF;
  RAISE NOTICE 'RUNTIME_BRAND_CRUD_ROUNDTRIP=PASS';
END
$checks$;
DELETE FROM public."Brand" WHERE slug='ci-role-compat-brand';
RESET ROLE;
SET ROLE ci_kpy_migrator_compat;
CREATE TABLE public.ci_migration_role_probe (id integer PRIMARY KEY);
INSERT INTO public.ci_migration_role_probe (id) VALUES (1);
DROP TABLE public.ci_migration_role_probe;
DO $checks$
BEGIN
  IF (SELECT rolsuper OR rolcreatedb OR rolcreaterole FROM pg_roles WHERE rolname=current_user) THEN RAISE EXCEPTION 'FAIL: migrator elevated'; END IF;
  BEGIN
    EXECUTE 'ALTER TABLE public."Product" ADD COLUMN ci_probe integer';
    RAISE EXCEPTION 'FAIL: migrator unexpectedly owns pre-existing table';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'MIGRATOR_EXISTING_TABLE_OWNERSHIP_GAP=CONFIRMED';
  END;
  RAISE NOTICE 'MIGRATOR_NEW_DDL_PASS';
END
$checks$;
RESET ROLE;
ROLLBACK;
SELECT CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('ci_kpy_runtime_compat','ci_kpy_migrator_compat')) THEN 'FAIL: role leaked' ELSE 'ROLE_COMPAT_ROLLBACK=PASS' END AS result;
