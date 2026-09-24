#!/bin/sh
set -eu

cd "$(dirname "$0")/../.."

COMPOSE="docker-compose.staging.yml"

echo "=== KuangPeiYun Staging Deploy ==="

if [ ! -f ".env.staging" ]; then
  echo "FAIL: .env.staging does not exist"
  echo "Create it from .env.staging.example first."
  exit 1
fi

echo "[1/5] Build staging image"
docker compose -f "$COMPOSE" --env-file .env.staging build app-staging

echo "[2/5] Start staging PostgreSQL"
docker compose -f "$COMPOSE" --env-file .env.staging up -d postgres-staging

echo "[3/5] Apply Prisma migrations"
docker compose -f "$COMPOSE" --env-file .env.staging run --rm app-staging \
  npx prisma migrate deploy

echo "[4/5] Start staging application"
docker compose -f "$COMPOSE" --env-file .env.staging up -d app-staging

echo "[5/5] Smoke test"
i=0
until curl -fsS http://127.0.0.1:3100/ >/dev/null 2>&1; do
  i=$((i + 1))

  if [ "$i" -ge 30 ]; then
    echo "FAIL: staging app did not become ready"
    docker compose -f "$COMPOSE" --env-file .env.staging logs --tail=100 app-staging
    exit 1
  fi

  sleep 2
done

./scripts/staging/smoke.sh

echo "=== STAGING DEPLOY PASS ==="
