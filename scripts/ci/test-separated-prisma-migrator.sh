#!/usr/bin/env bash
set -euo pipefail
# CI disposable PostgreSQL only; never point this at production.
: "${CI:?This test is CI-only}"
: "${DATABASE_URL:?CI database URL required}"
case "$DATABASE_URL" in
  postgresql://ci_user:ci_password@127.0.0.1:5432/kuangpeiyun_ci) ;;
  *) echo 'REFUSE: non-CI DATABASE_URL' >&2; exit 2 ;;
esac
export PGPASSWORD=ci_password
psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -U ci_user -d kuangpeiyun_ci <<'SQL'
CREATE ROLE ci_migrator_separate LOGIN PASSWORD 'ci_migrator_test_only' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE ci_runtime_separate LOGIN PASSWORD 'ci_runtime_test_only' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
SQL
psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -U ci_user -d postgres -c 'CREATE DATABASE ci_migration_separated OWNER ci_migrator_separate;'
psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -U ci_user -d ci_migration_separated <<'SQL'
ALTER SCHEMA public OWNER TO ci_migrator_separate;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO ci_runtime_separate;
SQL
export DATABASE_URL='postgresql://ci_migrator_separate:ci_migrator_test_only@127.0.0.1:5432/ci_migration_separated?schema=public'
npx prisma migrate deploy
npx prisma migrate status
export PGPASSWORD=ci_runtime_test_only
psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -U ci_runtime_separate -d ci_migration_separated <<'SQL'
DO $test$
BEGIN
  IF has_schema_privilege(current_user,'public','CREATE') THEN RAISE EXCEPTION 'runtime has schema CREATE'; END IF;
  IF pg_has_role(current_user,'ci_migrator_separate','MEMBER') THEN RAISE EXCEPTION 'runtime member of migrator'; END IF;
  IF (SELECT rolsuper OR rolcreatedb OR rolcreaterole FROM pg_roles WHERE rolname=current_user) THEN RAISE EXCEPTION 'runtime elevated'; END IF;
  RAISE NOTICE 'SEPARATE_MIGRATOR_RUNTIME_BOUNDARY=PASS';
END
$test$;
SQL
printf 'SEPARATE_PRISMA_MIGRATOR=PASS\n'
