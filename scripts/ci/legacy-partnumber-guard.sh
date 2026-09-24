#!/bin/sh
set -eu

echo "=== PartNumber Legacy Guard ==="

if sed -n "/^model PartNumber {/,/^}/p" prisma/schema.prisma | grep -Eq "^[[:space:]]*equipmentId[[:space:]]"; then
  echo "FAIL: legacy PartNumber.equipmentId exists"
  exit 1
fi

echo "PASS: PartNumber.equipmentId absent"
echo "LEGACY GUARD PASS"
