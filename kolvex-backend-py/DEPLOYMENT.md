# Kolvex Backend 部署指南

## 📋 目录
- [本地开发环境](#本地开发环境)
- [Docker 部署](#docker-部署)
- [推荐的部署平台](#推荐的部署平台)
- [生产环境最佳实践](#生产环境最佳实践)

## 🚀 本地开发环境

### 1. 传统方式（虚拟环境）

```bash
# 创建虚拟环境
python -m venv venv

# 激活虚拟环境
source venv/bin/activate  # macOS/Linux
# 或
.\venv\Scripts\activate   # Windows

# 安装依赖
pip install -r requirements.txt

# 复制环境变量文件
cp .env.example .env

# 编辑 .env 文件，配置数据库等信息
vim .env

# 启动开发服务器
python main.py
# 或
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Docker Compose 方式（推荐）

```bash
# 复制环境变量文件
cp .env.example .env

# 编辑 .env 文件（可选，使用默认值也可以）
vim .env

# 启动所有服务（后端 + 数据库）
docker-compose up -d

# 查看日志
docker-compose logs -f backend

# 停止服务
docker-compose down

# 停止并删除数据卷
docker-compose down -v
```

访问：
- API: http://localhost:8000
- API 文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/health

## 🐳 Docker 部署

### 开发环境

```bash
# 构建镜像
docker-compose build

# 启动服务
docker-compose up -d

# 查看运行状态
docker-compose ps

# 进入容器
docker-compose exec backend bash

# 查看日志
docker-compose logs -f backend
```

### 生产环境

```bash
# 使用生产环境配置
docker-compose -f docker-compose.prod.yml up -d

# 或者只构建后端镜像
docker build -f Dockerfile.prod -t kolvex-backend:latest .

# 运行容器
docker run -d \
  --name kolvex-backend \
  -p 8000:8000 \
  -e DATABASE_URL=postgresql://user:pass@host:5432/db \
  -e SECRET_KEY=your-secret-key \
  kolvex-backend:latest
```

## ☁️ 推荐的部署平台

### 1. 🥇 Railway (强烈推荐)
**优势：**
- ✅ 免费额度充足（$5/月）
- ✅ 支持 FastAPI 和 PostgreSQL
- ✅ 自动从 GitHub 部署
- ✅ 内置 PostgreSQL 数据库
- ✅ 零配置 HTTPS
- ✅ 自动扩展

**部署步骤：**
1. 访问 https://railway.app
2. 连接 GitHub 仓库
3. 选择 `kolvex-backend-py` 目录
4. 添加 PostgreSQL 服务
5. 设置环境变量
6. 一键部署

```bash
# 安装 Railway CLI
npm i -g @railway/cli

# 登录
railway login

# 初始化项目
railway init

# 部署
railway up
```

### 2. 🥈 Render
**优势：**
- ✅ 免费套餐
- ✅ 支持 Docker 和 原生 Python
- ✅ 托管 PostgreSQL
- ✅ 自动 SSL
- ✅ 零配置部署

**部署步骤：**
1. 访问 https://render.com
2. 创建 Web Service
3. 连接 GitHub 仓库
4. 选择 Docker 或 Python
5. 添加 PostgreSQL 数据库
6. 设置环境变量并部署

**Render 配置文件：** `render.yaml`
```yaml
services:
  - type: web
    name: kolvex-backend
    env: python
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: kolvex-db
          property: connectionString
      - key: SECRET_KEY
        generateValue: true

databases:
  - name: kolvex-db
    databaseName: kolvex
    user: kolvex
```

### 3. 🥉 Fly.io
**优势：**
- ✅ 优秀的性能
- ✅ 全球边缘部署
- ✅ 免费额度（3个应用）
- ✅ PostgreSQL 支持

**部署步骤：**
```bash
# 安装 Fly CLI
curl -L https://fly.io/install.sh | sh

# 登录
fly auth login

# 初始化应用
fly launch

# 创建 PostgreSQL
fly postgres create

# 连接数据库
fly postgres attach <postgres-app-name>

# 部署
fly deploy
```

### 4. Heroku
**优势：**
- ✅ 成熟稳定
- ✅ 丰富的插件生态
- ⚠️ 免费套餐已取消

**部署步骤：**
需要 `Procfile`：
```
web: uvicorn main:app --host 0.0.0.0 --port $PORT
```

```bash
heroku login
heroku create kolvex-backend
heroku addons:create heroku-postgresql:mini
git push heroku main
```

### 5. DigitalOcean App Platform
**优势：**
- ✅ 简单易用
- ✅ $5/月起
- ✅ 完整的云服务支持

### 6. AWS / GCP / Azure
**适合：** 大规模生产环境
- AWS: Elastic Beanstalk, ECS, Lambda
- GCP: Cloud Run, App Engine
- Azure: App Service

### 7. 自托管 (VPS)
**平台：**
- DigitalOcean Droplet
- Linode
- Vultr
- 阿里云、腾讯云

**使用 Docker Compose：**
```bash
# SSH 到服务器
ssh user@your-server-ip

# 安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# 克隆仓库
git clone https://github.com/your-username/kolvex.git
cd kolvex/kolvex-backend-py

# 配置环境变量
cp .env.example .env
vim .env

# 启动服务
docker-compose -f docker-compose.prod.yml up -d

# 配置 Nginx 反向代理（可选）
```

## 🔒 生产环境最佳实践

### 1. 环境变量
```bash
# 生成强密钥
python -c "import secrets; print(secrets.token_urlsafe(32))"

# 必须更改的环境变量
SECRET_KEY=<生成的强密钥>
DEBUG=False
POSTGRES_PASSWORD=<强密码>
ALLOWED_ORIGINS=https://your-domain.com
```

### 2. 数据库
- 使用托管数据库服务（Railway Postgres, Render PostgreSQL, AWS RDS）
- 定期备份数据
- 启用连接池
- 使用 SSL 连接

### 3. 安全性
- 使用 HTTPS（大多数平台自动提供）
- 设置强密钥和密码
- 限制 CORS 源
- 启用 rate limiting
- 使用环境变量存储敏感信息

### 4. 监控和日志
```python
# 添加日志
import logging
logging.basicConfig(level=logging.INFO)

# 添加性能监控（可选）
# Sentry, New Relic, DataDog
```

### 5. CI/CD
GitHub Actions 示例：`.github/workflows/deploy.yml`
```yaml
name: Deploy to Railway

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Railway
        run: railway up
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

## 📊 平台对比总结

| 平台 | 免费额度 | 易用性 | 速度 | 推荐度 |
|------|---------|--------|------|--------|
| Railway | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 🥇 强烈推荐 |
| Render | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 🥈 推荐 |
| Fly.io | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 🥉 推荐 |
| Heroku | ❌ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⚠️ 需付费 |
| VPS | N/A | ⭐⭐⭐ | ⭐⭐⭐⭐ | 💪 适合高级用户 |

## 🎯 个人推荐

**对于 Kolvex 项目，我推荐：**

1. **快速原型/开发阶段：** Railway
   - 最简单、最快速
   - 免费额度充足
   - 一键部署

2. **小规模生产：** Render 或 Railway
   - 稳定可靠
   - 成本低
   - 易于管理

3. **大规模生产：** AWS/GCP + Docker
   - 完整的云服务支持
   - 高可用性
   - 可扩展性强

## 🆘 常见问题

### 数据库连接失败
```bash
# 检查数据库是否就绪
docker-compose logs db

# 手动测试连接
docker-compose exec backend python -c "from sqlalchemy import create_engine; engine = create_engine('$DATABASE_URL'); print(engine.connect())"
```

### 端口已被占用
```bash
# 查找占用端口的进程
lsof -i :8000

# 杀死进程
kill -9 <PID>
```

### 环境变量未生效
```bash
# 确保 .env 文件存在
ls -la .env

# 重启服务
docker-compose restart backend
```

## 📚 更多资源

- [FastAPI 文档](https://fastapi.tiangolo.com/)
- [Docker 文档](https://docs.docker.com/)
- [Railway 文档](https://docs.railway.app/)
- [Render 文档](https://render.com/docs)

## 💡 下一步

1. ✅ 本地启动并测试
2. ✅ 配置环境变量
3. ✅ 选择部署平台
4. ✅ 设置 CI/CD
5. ✅ 配置监控和日志
6. ✅ 域名和 SSL

