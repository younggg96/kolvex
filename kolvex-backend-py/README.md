# Kolvex Backend API

基于 FastAPI 的股票观点与 AI 投资分析后端。以下内容以 `app/api/routes/__init__.py` 当前注册的路由和业务服务为准，未表示线上第三方服务已经配置或通过端到端验证。

## 功能与 API

业务接口统一使用 `/api/v1` 前缀。需要用户身份或管理员权限的接口由认证依赖校验，具体参数及响应以 `/docs` 为准。

| 接口模块 | 功能 |
| --- | --- |
| `/auth` | 注册、登录、OAuth URL、退出、密码重置与修改、当前用户、令牌刷新 |
| `/users` | 用户资料查询、创建和修改，主题和语言偏好、资料删除、用户列表 |
| `/upload` | 文件或 Base64 头像上传、头像删除 |
| `/market` | 单只及批量报价、历史和日内数据、公司信息、财务指标、利润表、资产负债表、现金流、分红、分析师评级、财报信息、期权到期日和期权链、股票综合概览 |
| `/youtube-opinions` | 观点看板、股票详情、创作者资料；管理员 JSON 校验、单条和批量导入；按股票、创作者、情绪及日期筛选 |
| `/plaid` | 连接状态、Link Token 创建、Public Token 交换、持仓和投资交易同步、交易查询、断开连接 |
| `/portfolio` | 账户和持仓、公开分享、单个及批量持仓可见性、隐私设置、资产及盈亏历史、快照、组合与单只持仓 AI 分析 |
| `/chat` | 对话及消息管理、普通与流式 AI 回复、模型选择、数据源选择 |
| `/trading-analysis` | 启动分析、查询详情和历史、SSE 进度、公开报告列表和详情、发布、撤回、删除 |
| `/user-api-keys` | 用户模型密钥新增、更新、删除、脱敏展示、可用提供商查询 |
| `/admin` | 业务表记录数量、管理概览、用户列表、管理员权限调整、批量组合快照 |
| `/health`、`/ping` | API 健康与连通性检查 |

应用还提供根路径 `/`、包含 Redis 状态的 `/health`、Swagger `/docs`、ReDoc `/redoc` 和 `/openapi.json`。

### YouTube 股票观点

管理员通过 `POST /api/v1/youtube-opinions/validate` 预览校验，通过 `POST /api/v1/youtube-opinions/upload` 写入外部生成的分析 JSON。支持一个视频对象或视频对象数组。

服务提供股票、创作者和日期维度的汇总、看多／看空等观点分布、每日变化及公开频道资料。当前没有自动抓取视频并调用模型生成观点的完整流程。

### AI 金融助手与交易分析

聊天通过 LangGraph 将请求分配给金融问答或深度研究 Agent，调用行情、财务、历史价格、期权链、Tavily 网页搜索及当前用户持仓工具。对话与消息保存在 Supabase，支持普通回复和 SSE 流式回复。

交易分析使用仓库内置的 `tradingagents/`，支持选择市场、社交、新闻、基本面分析师，设置复杂推理及快速模型、多空辩论和风险讨论轮数。任务后台执行，结果和进度保存用于历史查询与报告分享；应用启动时会清理上次残留的运行状态。输出是分析报告和建议，没有自动下单接口。

用户模型密钥支持 OpenAI、Anthropic、DeepSeek、Qwen、Gemini、Kimi 和 Grok。投资组合 AI 分析另使用 Ollama，需要对应服务及模型可用。

## 技术栈与目录

- FastAPI、Uvicorn、Pydantic：HTTP API 与数据验证。
- Supabase Auth、Supabase PostgreSQL 和 Storage：认证、主要业务数据及头像存储。
- Redis：缓存和交易分析进度。
- yfinance、Plaid、YouTube Data API、Tavily：市场、投资账户、频道资料及网页搜索。
- LangGraph、LangChain、TradingAgents、Ollama：金融助手和分析。

SQLAlchemy、Alembic 和 asyncpg 仍在依赖列表中，但主要业务服务直接使用 Supabase 客户端。当前 SQL 迁移文件位于 `migrations/`，没有完整的 Alembic 迁移目录。

```text
kolvex-backend-py/
├── main.py                 # 应用入口、生命周期及路由注册
├── app/
│   ├── api/routes/         # API 模块
│   ├── api/dependencies/   # 用户认证及管理员校验
│   ├── core/               # 配置、Supabase、Redis
│   ├── services/           # 业务服务
│   └── agent/              # LangGraph 路由、Agent 和工具
├── tradingagents/          # 多智能体交易分析实现
├── migrations/             # SQL 文件，包含历史创建及退役迁移
├── tests/                  # YouTube 导入、看板及频道资料测试
├── requirements.txt
├── docker-compose.yml
└── railway.toml
```

## 本地启动

使用 Python 3.11+，先配置 Supabase 项目及所需业务表。

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

编辑 `.env`。现有示例保留了 Robinhood、Twilio 等旧配置，且缺少部分当前所需变量；请按下列配置表补充，不需要为退役功能配置凭据。

| 配置 | 用途 |
| --- | --- |
| `SUPABASE_URL`、`SUPABASE_KEY` | Supabase 项目 URL 和 anon key，用于当前认证客户端 |
| `SUPABASE_SERVICE_KEY` | 后端管理客户端使用的 service_role key；仅供服务端使用 |
| `SECRET_KEY` | 使用强随机值；Plaid 访问令牌加密由此派生密钥，已有连接时更换需要同步处理旧令牌 |
| `ALLOWED_ORIGINS` | 逗号分隔的前端来源，例如 `http://localhost:3000` |
| `REDIS_URL` | 本地通常为 `redis://localhost:6379/0` |
| `LLM_PROVIDER`、`LLM_MODEL` | 聊天默认提供商和模型；代码默认 `openai` / `gpt-4o-mini` |
| `OPENAI_API_KEY`、`ANTHROPIC_API_KEY`、`DEEPSEEK_API_KEY`、`QWEN_API_KEY`、`GOOGLE_API_KEY`、`KIMI_API_KEY`、`GROK_API_KEY` | 按所选提供商配置，也可由用户通过个人密钥接口提供 |
| `TAVILY_API_KEY` | 聊天和研究工具的网页搜索 |
| `OLLAMA_BASE_URL`、`OLLAMA_MODEL`、`OLLAMA_TIMEOUT` | 本地模型服务地址、已安装模型及超时；本地默认地址 `http://localhost:11434`，模型需配置 |
| `PLAID_CLIENT_ID`、`PLAID_SECRET`、`PLAID_ENV`、`PLAID_CLIENT_NAME` | Plaid Investments；环境默认 `sandbox` |
| `PLAID_REDIRECT_URI`、`PLAID_WEBHOOK_URL` | 可选，创建 Plaid Link Token 时使用 |
| `YOUTUBE_DATA_API_KEY` | 获取 YouTube 公开频道资料；未配置时尝试使用 `GOOGLE_API_KEY` |

`DATABASE_URL` 和 `POSTGRES_*` 用于仓库保留的本地数据库配置，不能替代 Supabase 配置。按需要检查 `tradingagents/dataflows/` 中的数据源配置。

```bash
python main.py
```

等效开发命令：

```bash
uvicorn main:app --host 0.0.0.0 --port 8080 --reload
```

访问：

- API：`http://localhost:8080/api/v1`
- Swagger：`http://localhost:8080/docs`
- ReDoc：`http://localhost:8080/redoc`
- 健康检查：`http://localhost:8080/health`

### 数据库准备

根据目标 Supabase 数据库当前结构和迁移记录，审核并执行需要的 SQL。`migrations/` 同时包含旧功能创建文件和移除表的文件，不应将整个目录无差别执行。启动应用不会自动执行这些迁移，也不会自动创建所需业务表或 Storage bucket。

## Docker 与部署配置

配置好 `.env` 后：

```bash
docker compose up -d --build
docker compose logs -f backend
docker compose down
```

开发 Compose 启动后端、Redis 和本地 PostgreSQL，后端映射 `8080:8080`，仍需连接配置好的 Supabase。Ollama 默认连接宿主机 `http://host.docker.internal:11434`，需要宿主机服务和所选模型可用。

生产编排位于 `docker-compose.prod.yml`，包括 Ollama 容器；模型需要另行安装。Railway 配置位于 `railway.toml`，通过 `$PORT` 启动，未设置时使用 `8000`，健康检查路径为 `/health`。这些配置文件的存在不代表已完成部署验证。

部分 Makefile 和启动脚本仍使用旧的 `8000` 提示或 Alembic 命令；本地操作优先使用本文的直接命令。

## 测试

现有 YouTube 测试使用 Python `unittest`：

```bash
python -m unittest discover -s tests -p 'test_*.py'
```

这些测试覆盖导入校验、观点聚合与频道资料等行为，不代表所有 API 或外部服务均经过端到端验证。

## 已退役功能

不再注册 Robinhood、IBKR、旧 Twitter／小红书 KOL、独立新闻聚合、超级投资者持仓、量化策略及回测、股票追踪、用户关注、通知及定时预警、期权异动及独立期权 AI 分析接口。当前启动流程没有启用旧 Finnhub WebSocket 监控或通知调度。

历史 SQL、依赖、配置或残留辅助文件不代表这些功能仍可用。普通期权链、Plaid 连接和共享投资组合功能仍保留；Next.js 中的联系邮件接口已禁用。
