# 生产环境 Next.js Dockerfile
# 多阶段构建，优化镜像大小

# ============================================
# 阶段 1: 依赖安装
# ============================================
FROM node:20-alpine AS deps
WORKDIR /app

# 安装 libc6-compat 用于 Alpine 兼容性
RUN apk add --no-cache libc6-compat

# 复制依赖文件
COPY package.json package-lock.json ./

# 安装依赖
RUN npm ci --only=production

# ============================================
# 阶段 2: 构建
# ============================================
FROM node:20-alpine AS builder
WORKDIR /app

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 构建参数（环境变量）
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_API_URL

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# 禁用遥测
ENV NEXT_TELEMETRY_DISABLED=1

# 构建应用
RUN npm run build

# ============================================
# 阶段 3: 运行
# ============================================
FROM node:20-alpine AS runner
WORKDIR /app

# 设置为生产环境
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 复制必要文件
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# 设置正确的权限用于 Next.js 输出追踪
RUN mkdir .next
RUN chown nextjs:nodejs .next

# 复制构建输出
# 利用 Next.js 输出追踪来减少镜像大小
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 切换到非 root 用户
USER nextjs

# 暴露端口
EXPOSE 3000

# 设置主机名
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# 启动应用
CMD ["node", "server.js"]

