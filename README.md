# Kolvex - 股票分析平台

Kolvex 是一个现代化的股票分析平台，整合社交媒体内容、市场数据和 KOL 追踪功能。

## 项目结构

这是一个 Monorepo 项目，包含前端和后端两个子项目：

```
kolvex/
├── kolvex-frontend-web-nextjs/    # Next.js 前端应用
└── kolvex-backend-py/             # FastAPI 后端 API
```

## 子项目

### 前端 (kolvex-frontend-web-nextjs)

基于 Next.js 14+ 的现代化 Web 应用，提供：

- 📊 实时股票数据展示
- 👥 KOL 追踪和内容聚合
- 📰 多平台新闻整合（Twitter, Reddit, YouTube, 小红书）
- 📈 股票图表和技术分析
- 🔔 实时通知和订阅功能
- 🌓 暗黑模式支持

**技术栈：** Next.js, React, TypeScript, TailwindCSS, Supabase

👉 [查看前端详细文档](./kolvex-frontend-web-nextjs/README.md)

### 后端 (kolvex-backend-py)

基于 FastAPI 的高性能 Python 后端，提供：

- 🚀 RESTful API 服务
- 🔐 用户认证和授权
- 💾 数据持久化
- 🔄 数据同步和处理
- 📊 数据分析服务

**技术栈：** FastAPI, SQLAlchemy, PostgreSQL, Alembic

👉 [查看后端详细文档](./kolvex-backend-py/README.md)

## 快速开始

### 前提条件

- Node.js 18+ 
- Python 3.11+
- PostgreSQL 14+
- npm 或 yarn

### 1. 克隆项目

```bash
git clone https://github.com/yourusername/kolvex.git
cd kolvex
```

### 2. 启动前端

```bash
cd kolvex-frontend-web-nextjs
npm install
cp .env.example .env.local
# 编辑 .env.local 配置环境变量
npm run dev
```

前端将在 http://localhost:3000 启动

### 3. 启动后端

```bash
cd ../kolvex-backend-py
python -m venv venv
source venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
cp .env.example .env
# 编辑 .env 配置环境变量
python main.py
```

后端将在 http://localhost:8000 启动

## 开发指南

### 项目约定

- **代码风格**：前端使用 ESLint + Prettier，后端使用 Black + Flake8
- **提交规范**：使用 Conventional Commits
- **分支策略**：Git Flow

### 环境变量

每个子项目都有自己的环境变量配置：

- 前端：`kolvex-frontend-web-nextjs/.env.local`
- 后端：`kolvex-backend-py/.env`

请参考各自的 `.env.example` 文件配置。

## 部署

### 前端部署 (Vercel)

```bash
cd kolvex-frontend-web-nextjs
vercel --prod
```

### 后端部署 (Docker)

```bash
cd kolvex-backend-py
docker build -t kolvex-backend .
docker run -p 8000:8000 kolvex-backend
```

## 贡献指南

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 联系方式

- 项目链接：https://github.com/yourusername/kolvex
- 问题反馈：https://github.com/yourusername/kolvex/issues

---

**Built with ❤️ by Kolvex Team**

