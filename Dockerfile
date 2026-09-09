# ========== 矿配云 Dockerfile ==========
# 多阶段构建：builder → runner

# ---- 阶段1：构建 ----
FROM node:20-alpine AS builder
WORKDIR /app

# 安装依赖（利用 Docker 缓存）
COPY package.json package-lock.json* ./
RUN npm ci

# 复制源码并构建
COPY . .
RUN npx prisma generate
RUN npm run build

# ---- 阶段2：运行 ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production

# 复制必要文件
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/next.config.js ./

# 启动时自动执行 prisma db push + 启动
EXPOSE 3000
CMD ["sh", "-c", "npx prisma db push --skip-generate && npm run start"]
