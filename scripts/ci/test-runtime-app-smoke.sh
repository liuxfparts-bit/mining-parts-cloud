#!/usr/bin/env bash
set -euo pipefail
# Run only against the disposable CI database created by test-separated-prisma-migrator.sh.
: "${CI:?CI only}"
if [[ "${DATABASE_URL:-}" != 'postgresql://ci_user:ci_password@127.0.0.1:5432/kuangpeiyun_ci' ]]; then
  echo 'REFUSE: unexpected database URL' >&2; exit 2
fi
export PGPASSWORD=ci_password
psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -U ci_user -d ci_migration_separated <<'SQL'
DO $grant$
DECLARE obj record;
BEGIN
  FOR obj IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN ('EvidenceSource','EvidenceItem','EvidenceReviewEvent') LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO ci_runtime_separate',obj.tablename);
  END LOOP;
  FOR obj IN SELECT sequencename FROM pg_sequences WHERE schemaname='public' LOOP
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE public.%I TO ci_runtime_separate',obj.sequencename);
  END LOOP;
END
$grant$;
GRANT SELECT, INSERT ON TABLE "EvidenceSource", "EvidenceItem", "EvidenceReviewEvent" TO ci_runtime_separate;
SQL
export PGPASSWORD=ci_runtime_test_only
psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -U ci_runtime_separate -d ci_migration_separated <<'SQL'
DO $verify$
BEGIN
  IF has_schema_privilege(current_user,'public','CREATE') THEN RAISE EXCEPTION 'runtime schema create'; END IF;
  IF has_table_privilege(current_user,'public."EvidenceSource"','UPDATE') THEN RAISE EXCEPTION 'runtime evidence update'; END IF;
  RAISE NOTICE 'RUNTIME_DB_PRIVILEGES=PASS';
END
$verify$;
SQL
export DATABASE_URL='postgresql://ci_runtime_separate:ci_runtime_test_only@127.0.0.1:5432/ci_migration_separated?schema=public'
export PORT=3197
npm run start -- --port "$PORT" > /tmp/kpy-runtime-smoke.log 2>&1 &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT
ready=0
for i in $(seq 1 40); do
  if curl --silent --output /dev/null "http://127.0.0.1:$PORT/login"; then ready=1; break; fi
  if ! kill -0 "$server_pid" 2>/dev/null; then break; fi
  sleep 1
done
if [[ "$ready" != 1 ]]; then cat /tmp/kpy-runtime-smoke.log; exit 1; fi
for route in / /brands /equipment /rfqs /login; do
  code=$(curl --silent --output /tmp/kpy-smoke-page.html --write-out '%{http_code}' --max-time 15 "http://127.0.0.1:$PORT$route")
  echo "RUNTIME_HTTP_SMOKE $route $code"
  if [[ "$code" != 200 ]]; then
    echo "FAILED $route" >&2
    tail -50 /tmp/kpy-runtime-smoke.log >&2
    exit 1
  fi
done
printf 'RUNTIME_HTTP_SMOKE=PASS\n'
