# Kolvex Backend API

基于 FastAPI 的后端服务，为 Kolvex 股票分析平台提供 API 支持。

## 技术栈

- **FastAPI** - 现代、快速的 Web 框架
- **SQLAlchemy** - ORM 数据库操作
- **PostgreSQL** - 主数据库
- **Alembic** - 数据库迁移工具
- **Pydantic** - 数据验证
- **JWT** - 用户认证

## 🚀 快速开始

### 最简单的方式（推荐 Docker）

```bash
# 一键启动（自动创建 .env 并启动所有服务）
make setup

# 或使用脚本
./start.sh
```

### 方式 1: Docker Compose（推荐）

```bash
# 1. 复制环境变量
cp .env.example .env

# 2. 启动所有服务（后端 + PostgreSQL）
docker-compose up -d

# 3. 查看日志
docker-compose logs -f backend

# 4. 停止服务
docker-compose down
```

### 方式 2: 本地 Python 环境

```bash
# 1. 创建虚拟环境
python3 -m venv venv
source venv/bin/activate

# 2. 安装依赖
pip install -r requirements.txt

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 文件

# 4. 启动数据库（需要 PostgreSQL）
# 选项 A: 只用 Docker 运行数据库
docker-compose up -d db

# 选项 B: 使用本地 PostgreSQL
# macOS: brew install postgresql@15
# Ubuntu: sudo apt install postgresql

# 5. 运行开发服务器
python main.py
```

### 方式 3: 使用启动脚本

```bash
# 本地 Python 环境（智能检测 Docker）
./start-local.sh

# Docker 环境
./start.sh
```

### 访问服务

- 🌐 **API**: http://localhost:8000
- 📖 **Swagger 文档**: http://localhost:8000/docs
- 📘 **ReDoc**: http://localhost:8000/redoc
- ❤️ **健康检查**: http://localhost:8000/health

## API 文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 项目结构

```
kolvex-backend-py/
├── app/
│   ├── api/          # API 路由
│   ├── core/         # 核心配置
│   ├── models/       # 数据库模型
│   ├── schemas/      # Pydantic 模式
│   ├── services/     # 业务逻辑
│   └── utils/        # 工具函数
├── alembic/          # 数据库迁移
├── tests/            # 测试文件
├── main.py           # 应用入口
├── requirements.txt  # 依赖列表
└── .env              # 环境变量
```

## 开发指南

### 添加新的 API 路由

1. 在 `app/api/routes/` 创建新的路由文件
2. 在 `app/api/routes/__init__.py` 中注册路由
3. 在 `main.py` 中引入

### 数据库迁移

```bash
# 创建迁移
alembic revision --autogenerate -m "描述"

# 执行迁移
alembic upgrade head

# 回滚
alembic downgrade -1
```

## 测试

```bash
pytest
```

## 📋 常用命令

查看所有可用命令：
```bash
make help
```

常用操作：
```bash
make docker-dev    # 启动开发环境
make logs          # 查看日志
make ps            # 查看状态
make shell         # 进入容器
make down          # 停止服务
make clean         # 清理所有
make health        # 健康检查
```

## 🚢 Docker 部署

项目包含完整的 Docker 配置：

- `Dockerfile` - 开发环境镜像
- `Dockerfile.prod` - 生产环境镜像（多阶段构建，优化大小）
- `docker-compose.yml` - 开发环境编排
- `docker-compose.prod.yml` - 生产环境编排

### 开发环境
```bash
docker-compose up -d
```

### 生产环境
```bash
docker-compose -f docker-compose.prod.yml up -d
```

## ☁️ 云端部署

### 推荐平台（按优先级）

1. **🥇 Railway** - 最简单，免费额度充足
   ```bash
   npm i -g @railway/cli
   railway login
   railway init
   railway up
   ```

2. **🥈 Render** - 稳定可靠，免费套餐
   - 访问 https://render.com
   - 连接 GitHub 仓库
   - 选择 Docker 部署
   - 自动配置 PostgreSQL

3. **🥉 Fly.io** - 高性能，全球部署
   ```bash
   fly launch
   fly postgres create
   fly deploy
   ```

4. **其他选项**
   - Heroku（需付费）
   - DigitalOcean App Platform
   - AWS / GCP / Azure
   - VPS（自托管）

详细部署指南请查看：
- 📚 [DEPLOYMENT.md](./DEPLOYMENT.md) - 完整部署文档
- 🚀 [QUICKSTART.md](./QUICKSTART.md) - 快速启动指南

## 📁 项目结构

```
kolvex-backend-py/
├── app/
│   ├── api/          # API 路由
│   │   ├── routes/   # 路由定义
│   │   └── dependencies/  # 依赖注入
│   ├── core/         # 核心配置
│   │   └── config.py # 应用配置
│   ├── models/       # SQLAlchemy 模型
│   ├── schemas/      # Pydantic 模式
│   ├── services/     # 业务逻辑
│   └── utils/        # 工具函数
├── alembic/          # 数据库迁移
├── tests/            # 测试文件
├── main.py           # 应用入口
├── requirements.txt  # Python 依赖
├── Dockerfile        # Docker 镜像
├── docker-compose.yml # Docker 编排
├── Makefile          # 快捷命令
├── .env.example      # 环境变量模板
└── README.md         # 本文档
```

## 🔧 配置说明

### 环境变量

关键配置项（`.env` 文件）：

```bash
# 应用配置
DEBUG=True                    # 开发模式
SECRET_KEY=your-secret-key    # JWT 密钥（生产环境必须修改！）

# 数据库
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# CORS
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
```

生产环境注意事项：
- ✅ 设置强 SECRET_KEY
- ✅ DEBUG=False
- ✅ 使用强密码
- ✅ 限制 CORS 源
- ✅ 使用 HTTPS

## 部署

详细部署说明请查看 [DEPLOYMENT.md](./DEPLOYMENT.md)

快速开始请查看 [QUICKSTART.md](./QUICKSTART.md)

## 许可证

MIT

