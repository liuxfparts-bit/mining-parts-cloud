# 矿配云 Mining Parts Cloud

> 找设备 · 找配件 · 找厂家 · 发询价
> Find Equipment · Find Parts · Find Suppliers · Post RFQs

中国矿山设备与配件专业展示、找货与询价 B2B 平台 MVP。

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 14 (App Router) + TypeScript |
| 样式 | Tailwind CSS 3 |
| ORM | Prisma 5 |
| 数据库 | 开发：SQLite（零配置） / 生产：PostgreSQL |

## 快速启动

```bash
# 1. 安装依赖（已完成）
npm install

# 2. 初始化数据库（已完成）
npx prisma db push
npx tsx prisma/seed.ts

# 3. 启动开发服务器
npm run dev
```

访问 http://localhost:3000

## 已实现 MVP 功能

### 数据模型
- **Brand** 品牌（CAT / Sandvik / JOY / Komatsu / Eickhoff / Epiroc / Cummins / Parker）
- **Equipment** 设备（10 台：LHD / Bolter Miner / Shuttle Car / Shearer 等）
- **Part** 配件（18 个件号，含 XP210162、A2U220-324006 等）
- **Supplier** 供应商（5 家，含山西宁东机电等）
- **PartSupplier** 配件-供应商报价关联（价格/库存/交期）
- **RFQ** 询价单（含品牌/设备型号/件号/数量/联系人）
- **RFQQuote** 询价报价（供应商对询价单的回复）

### 页面
| 路由 | 功能 |
|------|------|
| `/` | 首页：Hero 搜索 + 热门品牌 + 热门设备 + 热门配件 + 最新询价 + 优选供应商 + CTA |
| `/equipment` | 设备列表（按品牌分类浏览） |
| `/equipment/[id]` | 设备详情：设备信息 + 全部相关配件列表 + 最低价格 |
| `/parts` | 配件列表（件号数据库） |
| `/parts/[id]` | 配件详情：件号信息 + 适配设备 + 所有可供货供应商及报价 + 一键询价按钮 |
| `/suppliers` | 供应商列表 |
| `/suppliers/[id]` | 供应商详情：企业信息 + 可供货件号清单 + 报价 |
| `/rfq` | 询价大厅：最新采购需求列表 |
| `/rfq/new` | 发布询价表单（支持从配件详情页带件号跳转） |
| `/search?q=关键词` | 全局搜索：同时搜索配件/设备/供应商 |

### API
| 路由 | 方法 | 功能 |
|------|------|------|
| `/api/rfq` | GET | 获取全部询价单 |
| `/api/rfq` | POST | 提交新询价 |

### 核心业务链路
```
设备型号 (Sandvik MB670-1)
  → 相关配件 (XP210162)
    → 可供货厂家 (宁东机电 ¥850 / 河南铸业 ¥820)
      → 一键向厂家询价
```

## 切换到 PostgreSQL（生产环境）

1. 安装并启动 PostgreSQL，创建数据库 `mining_parts_cloud`
2. 修改 `.env`：
   ```
   DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/mining_parts_cloud?schema=public"
   ```
3. 修改 `prisma/schema.prisma`：
   ```
   datasource db {
     provider = "postgresql"
   }
   ```
4. 重新推送并播种：
   ```bash
   npx prisma db push
   npx tsx prisma/seed.ts
   ```

## 后续迭代路线

### Phase 2 - 企业功能
- [ ] 用户注册/登录（采购方 vs 供应商双角色）
- [ ] 供应商企业主页自助管理
- [ ] 企业认证流程

### Phase 3 - 询价深化
- [ ] 供应商收到询价通知并在线报价
- [ ] 采购方对比报价
- [ ] 询价单状态流转（征集中→已报价→已关闭）

### Phase 4 - 搜索与数据管理
- [ ] 全文搜索优化（PostgreSQL tsvector / Meilisearch）
- [ ] 件号模糊搜索、OEM件号互换推荐
- [ ] 后台管理：配件/设备/供应商 CRUD
- [ ] Excel 批量导入件号数据

### Phase 5 - 国际化与外贸
- [ ] 英文界面（面向俄罗斯、中东、非洲客户）
- [ ] WhatsApp / WeChat 在线沟通
- [ ] 多币种报价

## 项目结构

```
mining-parts-cloud/
├── prisma/
│   ├── schema.prisma      # 数据模型
│   └── seed.ts            # 初始种子数据
├── src/
│   ├── app/
│   │   ├── layout.tsx    # 全局布局（Header + Footer）
│   │   ├── page.tsx      # 首页
│   │   ├── equipment/     # 设备列表/详情
│   │   ├── parts/        # 配件列表/详情
│   │   ├── suppliers/    # 供应商列表/详情
│   │   ├── rfq/          # 询价大厅/发布询价
│   │   ├── search/       # 搜索结果页
│   │   └── api/          # API 路由
│   ├── components/       # Header/Footer/SearchBar/RFQForm 等
│   └── lib/prisma.ts     # Prisma 客户端单例
└── .env                  # 环境变量
```
