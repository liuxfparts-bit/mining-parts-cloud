#!/bin/bash
# ============================================================
# 矿配云 PostgreSQL MCP 第二阶段：安全检查 + 只读账号创建
# 执行环境：生产服务器（/opt/mining-parts-cloud）
# 性质：只读检查 + 创建只读角色（不修改现有数据）
# ============================================================

set -e

echo "============================================================"
echo "  第二阶段：安全检查 + doubao_readonly 账号创建"
echo "============================================================"

# ============================================================
# 第一部分：安全检查（只读，不修改任何配置）
# ============================================================

echo ""
echo "========== 1. Docker 端口映射检查 =========="
docker ps --format "table {{.Names}}\t{{.Ports}}" | grep -E "postgres|mining"

echo ""
echo "========== 2. PostgreSQL listen_addresses =========="
docker compose exec -T postgres sh -c 'grep -E "^listen_addresses|^#listen_addresses" /var/lib/postgresql/data/postgresql.conf || echo "listen_addresses: default (localhost)"'

echo ""
echo "========== 3. pg_hba.conf 配置 =========="
docker compose exec -T postgres sh -c 'cat /var/lib/postgresql/data/pg_hba.conf | grep -v "^#" | grep -v "^$"'

echo ""
echo "========== 4. UFW 防火墙状态 =========="
sudo ufw status || echo "ufw: not active or not installed"

echo ""
echo "========== 5. PostgreSQL 版本 =========="
docker compose exec -T postgres psql -U mining -d mining_parts_cloud -c "SELECT version();"

echo ""
echo "========== 6. 当前所有数据库角色 =========="
docker compose exec -T postgres psql -U mining -d mining_parts_cloud -c "\du"

echo ""
echo "========== 7. 确认 mining 数据库存在 =========="
docker compose exec -T postgres psql -U mining -d mining_parts_cloud -c "SELECT datname FROM pg_database WHERE datistemplate = false;"

echo ""
echo "============================================================"
echo "  安全检查完成"
echo "============================================================"

# ============================================================
# 第二部分：创建只读角色
# ============================================================

echo ""
echo "是否继续创建 doubao_readonly 角色？(yes/no)"
read -r CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "已取消。未创建任何角色。"
    exit 0
fi

# 生成随机密码（32位）
DB_PASSWORD=$(openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 32)

echo ""
echo "========== 8. 创建 doubao_readonly 角色 =========="

docker compose exec -T postgres psql -U mining -d mining_parts_cloud << EOF
-- 创建只读角色
CREATE ROLE doubao_readonly WITH
  LOGIN
  PASSWORD '$DB_PASSWORD'
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT;

-- 授予数据库连接权限
GRANT CONNECT ON DATABASE mining_parts_cloud TO doubao_readonly;

-- 授予 schema 使用权限
GRANT USAGE ON SCHEMA public TO doubao_readonly;

-- 授予所有现有表的 SELECT 权限
GRANT SELECT ON ALL TABLES IN SCHEMA public TO doubao_readonly;

-- 授予所有现有 sequence 的 SELECT 权限
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO doubao_readonly;

-- 设置默认权限：未来新建的表自动授予 SELECT
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT ON TABLES TO doubao_readonly;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT ON SEQUENCES TO doubao_readonly;
EOF

echo "角色创建完成。"

# ============================================================
# 第三部分：权限验证
# ============================================================

echo ""
echo "========== 9. 角色属性验证 =========="

docker compose exec -T postgres psql -U mining -d mining_parts_cloud -c "
SELECT
  rolname,
  rolsuper,
  rolcreatedb,
  rolcreaterole,
  rolcanlogin
FROM pg_roles
WHERE rolname = 'doubao_readonly';
"

echo ""
echo "========== 10. SELECT 权限验证（应成功） =========="

docker compose exec -T postgres psql -U doubao_readonly -d mining_parts_cloud -c "SELECT COUNT(*) AS partnumber_count FROM \"PartNumber\";"

echo ""
echo "========== 11. UPDATE 权限验证（应失败） =========="

docker compose exec -T postgres psql -U doubao_readonly -d mining_parts_cloud -c "
BEGIN;
UPDATE \"PartNumber\" SET id = id WHERE id = 999999;
ROLLBACK;
" 2>&1 || echo "UPDATE 被正确拒绝（预期行为）"

echo ""
echo "========== 12. INSERT 权限验证（应失败） =========="

docker compose exec -T postgres psql -U doubao_readonly -d mining_parts_cloud -c "
BEGIN;
INSERT INTO \"PartNumber\" (number, slug, name, category) VALUES ('TEST_ROLE_CHECK', 'test-role-check', 'Test', 'Uncategorized');
ROLLBACK;
" 2>&1 || echo "INSERT 被正确拒绝（预期行为）"

echo ""
echo "============================================================"
echo "  doubao_readonly 账号创建完成"
echo "============================================================"
echo ""
echo "角色名: doubao_readonly"
echo "数据库: mining_parts_cloud"
echo "密码: $DB_PASSWORD"
echo ""
echo "⚠️  请立即保存上述密码，脚本不会再次显示。"
echo "⚠️  密码不要写入任何 Git 仓库文件。"
echo ""
echo "============================================================"
