#!/bin/sh
set -eu

BASE_URL="${STAGING_BASE_URL:-http://127.0.0.1:3100}"

echo "=== KuangPeiYun Staging Smoke ==="

check() {
  name="$1"
  path="$2"
  expected="$3"

  code="$(curl -sS -o /dev/null -w '%{http_code}' "${BASE_URL}${path}")"

  if [ "$code" = "$expected" ]; then
    echo "PASS: $name HTTP $code"
  else
    echo "FAIL: $name HTTP $code (expected $expected)"
    exit 1
  fi
}

check "HOME" "/" "200"
check "PART NUMBER SEARCH" "/api/part-number/search?q=100" "200"

echo "STAGING SMOKE PASS"
