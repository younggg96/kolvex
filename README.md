# Kolvex — 股票观点与 AI 投资分析平台

Kolvex 整合 YouTube 创作者股票观点、市场行情、个人投资组合和 AI 投资分析。本仓库包含 Next.js 前端和 FastAPI 后端。

本文以当前代码中的路由和服务为准。第三方服务需要配置对应凭据；代码实现不代表线上环境已经配置或通过验证。

## 当前功能

| 模块 | 功能 |
| --- | --- |
| YouTube 股票观点 | 管理员校验和导入单条或批量分析 JSON；按股票、创作者、情绪、日期筛选；股票和创作者汇总、每日观点及变化、创作者资料 |
| 市场数据 | 单只及批量报价、历史和日内价格、公司信息、财务指标、三大财务报表、分红、分析师评级、财报信息、期权到期日及期权链 |
| 投资组合 | 通过 Plaid 连接投资账户，同步账户、持仓和投资交易记录；公开分享、持仓可见性、隐私设置、资产及盈亏历史快照 |
| 投资组合 AI 分析 | 使用 Ollama 分析组合风险、分散程度、持仓优缺点、调整建议和单只持仓 |
| AI 金融助手 | 保存对话和消息、流式回复、切换模型；通过 LangGraph 调用市场数据、网页搜索、个人持仓和交易分析工具 |
| 多智能体交易分析 | 市场、新闻、社交及基本面分析，多空辩论和风险讨论；后台运行、实时进度、历史报告、发布及撤回 |
| 用户与管理 | Supabase Auth 注册、登录、OAuth、密码管理；用户资料、头像、主题、语言偏好、个人模型 API Key、管理员用户和数据统计 |

YouTube 模块接收外部生成的分析结果，当前未提供自动抓取视频并生成观点的完整流程。交易分析输出研究报告和建议，当前没有自动下单接口。

Next.js 服务端还提供后端接口代理、行情缓存、指数聚合、文本翻译、图片代理及直接连接 Ollama 的聊天接口。

## 项目结构与技术栈

```text
kolvex/
├── kolvex-frontend-web-nextjs/   # Next.js 14、React 18、TypeScript、Tailwind CSS
└── kolvex-backend-py/            # FastAPI、Pydantic、Supabase、Redis
    ├── app/api/routes/          # HTTP API
    ├── app/services/            # 市场数据、Plaid、观点、聊天和分析服务
    ├── app/agent/               # LangGraph 金融助手与工具
    ├── tradingagents/          # 仓库内置的多智能体交易分析代码
    ├── migrations/             # SQL 迁移文件
    └── tests/                  # YouTube 观点相关测试
```

主要业务数据和认证使用 Supabase；市场数据使用 yfinance，投资账户使用 Plaid，网页搜索使用 Tavily。AI 功能分别使用云端模型和 Ollama。仓库仍保留 SQLAlchemy、Alembic 依赖及本地 PostgreSQL 编排，但主要业务代码通过 Supabase 客户端读写。

## 本地启动

需要 Node.js 18.17+、Python 3.11+ 和已配置的 Supabase 项目。Redis 用于缓存与分析进度；Ollama 用于本地模型功能。

### 后端

```bash
cd kolvex-backend-py
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

编辑 `.env`，补充 `SUPABASE_URL`、`SUPABASE_KEY`、`SUPABASE_SERVICE_KEY` 和随机生成的 `SECRET_KEY`。按需要配置模型、Plaid、Redis 等服务，详见[后端 README](./kolvex-backend-py/README.md)。现有 `.env.example` 包含部分旧配置，不是完整的当前配置清单。

```bash
python main.py
```

本地 API 为 `http://localhost:8080`，交互式文档为 `http://localhost:8080/docs`，健康检查为 `http://localhost:8080/health`。

### 前端

```bash
cd kolvex-frontend-web-nextjs
npm ci
```

创建 `.env.local`：

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_BACKEND_API_URL=http://127.0.0.1:8080
```

```bash
npm run dev
```

访问 `http://localhost:3000`。Supabase 服务端密钥只配置在后端。

### Docker 开发环境

完成后端 `.env` 配置后：

```bash
cd kolvex-backend-py
docker compose up -d --build
docker compose logs -f backend
```

当前开发 Compose 启动后端、Redis 和本地 PostgreSQL；仍需单独配置 Supabase。Ollama 默认通过 `host.docker.internal:11434` 连接宿主机服务。后端端口为 `8080`。

## 已退役功能

当前不再提供 Robinhood／IBKR 直接接入、旧 Twitter／小红书 KOL 追踪、独立新闻聚合、超级投资者持仓追踪、量化策略和回测、股票追踪、用户关注、通知及定时预警、期权异动和独立期权 AI 分析。普通期权链查询与 Plaid 投资组合功能保留。联系表单邮件发送已禁用。

相关移除 SQL 位于后端 `migrations/`；保留的历史迁移和依赖不代表功能仍然启用，也不能据此判断生产数据库是否已执行迁移。

## English overview

Kolvex combines imported YouTube stock opinions, market data, Plaid investment portfolios, an AI financial assistant, and multi-agent trading research. The monorepo uses Next.js for the frontend and FastAPI for the backend, with Supabase for authentication and business data, Redis for caching and analysis progress, and cloud LLMs or Ollama for AI features.

YouTube opinions are imported from externally generated JSON; an automated video-to-opinion pipeline is not currently implemented. Trading research produces reports and recommendations without order execution. Local frontend and backend ports are `3000` and `8080`. Feature availability depends on service credentials and database setup.

## License

[MIT](./LICENSE)
