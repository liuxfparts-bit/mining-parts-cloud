# 矿配云生产数据库角色隔离切换手册（草案，禁止直接执行）

**状态：仅供评审。无生产变更授权。PR #31 保持 Draft。**

## 当前生产事实
- 生产应用容器 `mining-parts-app` (`172.18.0.3`) 以 PostgreSQL `mining` 连接；`mining` 为 SUPERUSER、业务表所有者。
- 生产 PostgreSQL 容器 `mining-parts-postgres` (`172.18.0.2`)；数据库 `mining_parts_cloud`。
- `doubao_readonly` 在 `public` 上有 USAGE、无 CREATE；表级权限尚待核查。
- 生产尚未应用证据表迁移 0009。

## 方案与职责
- `kpy_runtime`：应用运行账户；非 superuser，非 owner，无 CREATE、无 role membership；现有业务表按需 DML，证据表只允许 SELECT/INSERT。
- `kpy_migrator`：受控迁移账户，独立密钥，不作为 Next.js 的 DATABASE_URL；需确定历史对象 ownership 迁移策略。
- `mining`：原管理/应急账户暂保留，切换成功后不再由应用使用；本阶段不降权、不改密。

## 上线前必须满足的检查（未完成不得实施）
1. 生产全量只读盘点：pg_roles/pg_auth_members、pg_class ownership（含 sequence）、pg_default_acl、schema/database privileges、SECURITY DEFINER 函数、扩展、RLS、触发器、活动连接。记录哈希化报告，不导出密码。
2. 隔离环境重放所有迁移；用真实独立 migrator 执行 `prisma migrate deploy`；用 runtime 启动网站并覆盖登录、产品、RFQ、报价、后台核心路径。
3. 明确迁移所有权策略：迁移用户仅有 CREATE 并不足以 ALTER `mining` 所有的历史表；可评估受控 ALTER OWNER 或维护角色 membership，但 **runtime 绝不能继承 owner/migrator**。需逐表、逐序列和函数验证，不可批量盲改。
4. 配置独立 secrets 的交付方式；确认 compose、CI、日志、备份均不暴露凭据；规划凭据轮换。
5. 验证一致性备份与隔离恢复，保存变更前部署镜像/commit、DB 状态和连接池配置；明确操作窗口和负责人。
6. 定义基线：登录、搜索、产品、询价、报价、管理员操作、API 5xx、数据库连接数、权限错误日志；在切换前后逐项比对。

## 拟定生产变更顺序（仅在另行授权后）
1. 宣告维护窗口、冻结部署和 schema 变更；核验最新备份可恢复。
2. 由独立 DBA/受控管理连接创建角色、设置必要的 schema/table/sequence/default privileges；执行只读权限核验和负面测试（只读查询为主，任何 DML 测试仅在隔离副本）。
3. 准备 runtime 独立凭据与配置，先验证其连接及查询权限；**不**先撤销旧 `mining` 权限。
4. 受控重启/滚动替换应用容器以切换 DATABASE_URL；核验新连接的 `usename` 和来源 IP。
5. 执行完整业务 smoke、审计日志和数据库错误监控；确认运行稳定后才考虑后续清理旧凭据。
6. 迁移部署必须显式使用 migrator 独立凭据，不允许应用启动时自动执行 DDL。

## 回滚策略（须先演练）
- 如出现权限错误、业务 5xx、RFQ/报价失败：停止继续切换，恢复原应用镜像及已知可用的连接配置，验证连接和业务恢复；保留变更期间产生的业务数据，不回滚真实交易数据。
- 权限 GRANT/REVOKE 与对象 owner 调整须留完整操作清单及逆操作，生产回滚不能靠禁用证据触发器。
- 如迁移改变 schema，不得仅通过切换 DATABASE_URL 宣称已回滚：须依据迁移兼容性和备份恢复演练单独决策。
- 生产回滚操作本身也需要事先授权及负责人；严禁在本阶段执行。

## 验收门槛
- GitHub CI 独立迁移账户测试通过、低权限网站 HTTP smoke 通过。
- 端到端认证/询价/报价业务测试通过（当前待办）；生产只读全权限盘点完成（当前待办）。
- 已核实生产备份可恢复，切换和回滚方案获用户单独批准（当前未获授权）。

**本文件不包含可直接执行的生产变更命令；不得视为生产切换许可。**
