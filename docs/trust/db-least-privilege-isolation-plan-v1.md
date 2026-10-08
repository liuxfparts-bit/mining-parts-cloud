# 矿配云数据库最小权限隔离方案 V1.0（隔离环境设计，非生产执行指令）

## 已核实的生产事实（用户只读查询，2026-10-08）
- `mining`：LOGIN/SUPERUSER/CREATEDB/CREATEROLE；`public` schema 与 User/Product/PartNumber 表 owner。
- 生产 app IP `172.18.0.3`，PostgreSQL IP `172.18.0.2`；14 个 idle 连接以 `mining` 登录，来源 app IP。
- `doubao_readonly`：LOGIN，无 SUPERUSER/CREATEDB/CREATEROLE；对 public 有 USAGE、无 CREATE。**未核验其表级权限，不宣称全库只读**。
- EvidenceSource/EvidenceItem/EvidenceReviewEvent 在生产尚不存在；迁移 0009 不得在本阶段执行。

## 权限目标
1. `kpy_runtime`（NO SUPERUSER/NO CREATEDB/NO CREATEROLE/NO BYPASSRLS；NO schema CREATE；不拥有业务表）：应用运行时；只授予必要表 SELECT/INSERT/UPDATE/DELETE 和必要序列 USAGE/SELECT。**Evidence 三表单独限制**：source/item/review 仅 SELECT/INSERT，不授予 UPDATE/DELETE/TRUNCATE；禁止触发器禁用/DDL；未来 Gate 必须依赖此隔离。
2. `kpy_migrator`：仅用于受控发布迁移，拥有 DDL 所需对象/Schema 权限，绝不用于 Next.js 常驻连接。需核对 Prisma 迁移对已有对象所有权的要求，不能简单假定 GRANT CREATE 足够。
3. `mining`：暂保留现有超级管理员身份用于应急；不作为应用 DATABASE_URL；**不直接降权/改密**。长期采用独立管理角色并审查 PostgreSQL 默认角色/扩展/对象所有权。
4. `doubao_readonly`：核对 public 下所有表、序列及默认权限（含敏感表），确保没有 DML/DDL、没有角色继承提权；必要时单独整改审批。

## 安全边界与隐含依赖
- PostgreSQL 表所有者可 ALTER TABLE DISABLE TRIGGER，SUPERUSER 也可绕过触发器；Evidence 的 append-only 不能仅依赖触发器。
- 应用使用 Prisma；应枚举所有现有模型、隐式关联表、序列和原生 SQL 操作，确定最小业务权限。现有业务表的 UPDATE/DELETE 权限不能贸然收回。
- Prisma migrate deploy 与常驻运行必须分离凭据；生产 compose 中硬编码凭据及容器环境变量泄露问题需要另立安全整改计划（不可在本次直接更改）。
- 创建未来新表时应由专用 migrator 设定 DEFAULT PRIVILEGES（按对象创建者逐一设置），并复核序列权限；迁移与运行时连接池独立。
- 如果 runtime 获得业务表 INSERT 权限，不能自动认定 DB 能校验 reviewerId 属于 ADMIN；须通过受控写入边界或触发器/会话身份绑定解决。

## 隔离验证矩阵（全部仅在 disposable test DB 执行）
- 正向：runtime SELECT/INSERT/UPDATE 正常业务表；插入 EvidenceSource、EvidenceItem、EvidenceReviewEvent 的允许状态；读取关联数据；Prisma 登录/RFQ/报价/管理页面 smoke tests。
- 反向：runtime `CREATE TABLE`、`ALTER TABLE`、`DROP TABLE`、`DISABLE TRIGGER`、`TRUNCATE`、`GRANT`、`SET ROLE migrator`、Evidence UPDATE/DELETE 均应拒绝。
- 反向：Evidence `CAPTURED_UNVERIFIED`、`CONFIRMED`、错误 fingerprint、跨目标撤销均应拒绝；即使直接 SQL 也应拒绝。
- 角色验证：`rolsuper=false`、`rolcreatedb=false`、`rolcreaterole=false`、`rolbypassrls=false`、`has_schema_privilege(runtime,'public','CREATE')=false`、`pg_has_role(runtime,migrator,'MEMBER')=false`、Evidence 三表 `has_table_privilege(...,'UPDATE/DELETE/TRUNCATE')=false`。
- 回滚演练：仅 disposable DB 中切回旧连接账户，验证连接恢复；**生产回滚不能依赖取消审计/关闭触发器**。

## 上线前决策门槛（本方案不构成上线授权）
1. 导出只读权限清单（所有业务表、序列、默认权限、角色继承、函数 SECURITY DEFINER、数据库 CONNECT/CREATE/TEMP）。
2. 通过独立 PostgreSQL 实例重放 0001–0009，分别使用 migrator/runtime 连接做完整测试；CI 增加 role-boundary 负面测试。
3. 明确迁移所有权策略、密码/Secret 管理、容器重建和最短停机切换方案；备份及恢复演练、回滚步骤、监控指标、负责人。
4. 单独获得用户明确授权后才能在生产创建账户、GRANT/REVOKE、改 compose、部署或执行迁移；PR #31 始终保持 Draft，直至新授权。

## 当前验证状态
- 这是审计设计和测试规范，不等于隔离 PostgreSQL 权限测试已通过。必须在隔离 PostgreSQL 服务可用时执行真实授权/拒绝测试，严禁以静态检查替代数据库测试。
