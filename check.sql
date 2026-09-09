-- 查看最新 User 和 Supplier
SELECT '=== Users ===' AS info;
SELECT id, email, name, role, "supplierId", "createdAt" FROM "User" ORDER BY "createdAt" DESC LIMIT 10;
SELECT '=== Suppliers ===' AS info;
SELECT id, name, "verifiedStatus", "contactName", "createdAt" FROM "Supplier" ORDER BY "createdAt" DESC LIMIT 10;
