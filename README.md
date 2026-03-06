# Kolvex - 股票分析平台 / Stock Analysis Platform

<div align="center">

**A Modern Stock Analysis Platform with Social Media Integration & KOL Tracking**

**现代化的股票分析平台，整合社交媒体内容、市场数据和 KOL 追踪功能**

[English](#english) | [中文](#chinese)

</div>

---

<a name="english"></a>

## 📖 About

Kolvex is a comprehensive stock analysis platform that integrates social media content, market data, and Key Opinion Leader (KOL) tracking capabilities to provide investors with real-time insights.

## 🏗️ Project Structure

This is a Monorepo project containing frontend and backend applications:

```
kolvex/
├── kolvex-frontend-web-nextjs/    # Next.js Frontend Application
└── kolvex-backend-py/             # FastAPI Backend API
```

## 📦 Sub-Projects

### Frontend (kolvex-frontend-web-nextjs)

Modern web application built with Next.js 14+, featuring:

- 📊 Real-time stock data visualization
- 👥 KOL tracking and content aggregation
- 📰 Multi-platform news integration (Twitter, Reddit, YouTube, RedNote)
- 📈 Stock charts and technical analysis
- 🔔 Real-time notifications and subscriptions
- 🌓 Dark mode support

**Tech Stack:** Next.js, React, TypeScript, TailwindCSS, Supabase

👉 [View Frontend Documentation](./kolvex-frontend-web-nextjs/README.md)

### Backend (kolvex-backend-py)

High-performance Python backend built with FastAPI, providing:

- 🚀 RESTful API services
- 🔐 User authentication and authorization
- 💾 Data persistence
- 🔄 Data synchronization and processing
- 📊 Data analysis services

**Tech Stack:** FastAPI, SQLAlchemy, PostgreSQL, Alembic

👉 [View Backend Documentation](./kolvex-backend-py/README.md)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Python 3.11+
- PostgreSQL 14+
- npm or yarn

### 1. Clone Repository

```bash
git clone https://github.com/younggg96/kolvex.git
cd kolvex
```

### 2. Start Frontend

```bash
cd kolvex-frontend-web-nextjs
npm install
cp .env.example .env.local
# Edit .env.local to configure environment variables
npm run dev
```

Frontend will start at http://localhost:3000

### 3. Start Backend

```bash
cd ../kolvex-backend-py
python -m venv venv
source venv/bin/activate  # macOS/Linux
# On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env to configure environment variables
python main.py
```

Backend will start at http://localhost:8000

## 📝 Development Guide

### Project Conventions

- **Code Style**: Frontend uses ESLint + Prettier, Backend uses Black + Flake8
- **Commit Convention**: Conventional Commits
- **Branching Strategy**: Git Flow

### Environment Variables

Each sub-project has its own environment configuration:

- Frontend: `kolvex-frontend-web-nextjs/.env.local`
- Backend: `kolvex-backend-py/.env`

Please refer to the respective `.env.example` files for configuration.

## 🚢 Deployment

### Frontend Deployment (Vercel)

```bash
cd kolvex-frontend-web-nextjs
vercel --prod
```

### Backend Deployment (Docker)

```bash
cd kolvex-backend-py
docker build -t kolvex-backend .
docker run -p 8000:8000 kolvex-backend
```

## 🤝 Contributing

1. Fork this repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 📧 Contact

- Repository: https://github.com/younggg96/kolvex
- Issues: https://github.com/younggg96/kolvex/issues

## 🧾 Progress Log

- **2025-02-22**: Replaced FinancialJuice widget with direct crawler. Added `financial_juice_scraper` (Playwright), webhook `POST /api/v1/news/webhook/fetch-financial-juice`, scheduled job (every 30 min), and `LiveNewsList` component. RSS webhook retained as fallback.
- **2025-12-12**: Refactored `TrackingStocksTable` row components into dedicated files under `kolvex-frontend-web-nextjs/components/tracking-stocks/`. Also converted stock detail page to SSR (server `page.tsx` + client interaction boundary).

---

<a name="chinese"></a>

## 📖 关于项目

Kolvex 是一个综合性的股票分析平台，整合社交媒体内容、市场数据和关键意见领袖（KOL）追踪功能，为投资者提供实时洞察。

## 🏗️ 项目结构

这是一个 Monorepo 项目，包含前端和后端两个应用：

```
kolvex/
├── kolvex-frontend-web-nextjs/    # Next.js 前端应用
└── kolvex-backend-py/             # FastAPI 后端 API
```

## 📦 子项目

### 前端 (kolvex-frontend-web-nextjs)

基于 Next.js 14+ 的现代化 Web 应用，功能包括：

- 📊 实时股票数据可视化
- 👥 KOL 追踪和内容聚合
- 📰 多平台新闻整合（Twitter, Reddit, YouTube, 小红书）
- 📈 股票图表和技术分析
- 🔔 实时通知和订阅功能
- 🌓 深色模式支持

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

## 🚀 快速开始

### 前提条件

- Node.js 18+
- Python 3.11+
- PostgreSQL 14+
- npm 或 yarn

### 1. 克隆项目

```bash
git clone https://github.com/younggg96/kolvex.git
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
# Windows 系统: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# 编辑 .env 配置环境变量
python main.py
```

后端将在 http://localhost:8000 启动

## 📝 开发指南

### 项目约定

- **代码风格**：前端使用 ESLint + Prettier，后端使用 Black + Flake8
- **提交规范**：遵循 Conventional Commits
- **分支策略**：Git Flow

### 环境变量

每个子项目都有自己的环境变量配置：

- 前端：`kolvex-frontend-web-nextjs/.env.local`
- 后端：`kolvex-backend-py/.env`

请参考各自的 `.env.example` 文件进行配置。

## 🚢 部署

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

## 🤝 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 📧 联系方式

- 项目地址：https://github.com/younggg96/kolvex
- 问题反馈：https://github.com/younggg96/kolvex/issues

## 🧾 进度日志

- **2025-12-12**：将 `TrackingStocksTable` 的行/骨架/表头组件拆分为 `kolvex-frontend-web-nextjs/components/tracking-stocks/` 下的独立文件；并将股票详情页改为 SSR（服务端 `page.tsx` + 客户端交互边界）。

---

<div align="center">

**Built with ❤️ by Kolvex Team**

</div>
