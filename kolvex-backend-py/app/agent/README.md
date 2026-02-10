# Kolvex AI Agent System

基于 **LangGraph** 构建的多 Agent 金融智能助手系统。

---

## 目录

- [系统概述](#系统概述)
- [架构设计](#架构设计)
- [目录结构](#目录结构)
- [核心模块详解](#核心模块详解)
  - [1. LLM Factory (llm.py)](#1-llm-factory-llmpy)
  - [2. Agent State (state.py)](#2-agent-state-statepy)
  - [3. Tools 工具层](#3-tools-工具层)
  - [4. Graphs 图定义层](#4-graphs-图定义层)
  - [5. Memory 记忆层](#5-memory-记忆层)
- [请求处理流程](#请求处理流程)
- [API 接口说明](#api-接口说明)
- [配置与部署](#配置与部署)
- [使用示例](#使用示例)
- [扩展指南](#扩展指南)

---

## 系统概述

Kolvex AI Agent 不是一个简单的 LLM 聊天机器人，而是一个**能够自主调用工具获取实时数据**的智能系统。

传统方式（改造前）：

```
用户消息 → LLM → 纯文本回答（基于训练数据，无法获取实时信息）
```

Agent 方式（改造后）：

```
用户: "NVDA 现在多少钱？"
  → Supervisor 分类意图 → Financial Agent
  → Agent 思考：需要查股价 → 调用 get_stock_quote("NVDA")
  → 获取到实时数据：$875.28, +2.3%
  → Agent 组织回答：NVDA 当前价格 $875.28，今日上涨 2.3%...
```

**核心能力：**

| 能力 | 说明 |
|------|------|
| 实时股票查询 | 价格、财务指标、分析师评级、历史数据 |
| 新闻搜索分析 | 多源新闻聚合（Yahoo Finance、Benzinga） |
| KOL 情感分析 | 推特 KOL 观点汇总、看多/看空比例 |
| 投资组合分析 | 查看用户持仓、权重、盈亏 |
| 知识库搜索 | KOL 推文、新闻、小红书帖子全文检索 |
| 超级投资者持仓 | Dataroma 对冲基金持仓数据 |
| 深度研究报告 | 自动多步骤调研，生成结构化分析报告 |
| 多语言支持 | 自动识别中文/英文，用对应语言回复 |

---

## 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                        客户端                                │
│              Mobile App (RN)  /  Web (Next.js)              │
└──────────────────────┬──────────────────────────────────────┘
                       │  POST /api/v1/chat/conversations/{id}/send
                       │  POST /api/v1/chat/conversations/{id}/stream (SSE)
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI Backend                           │
│  ┌─────────────┐  ┌──────────────────────────────────────┐ │
│  │  Chat CRUD   │  │       LangGraph Agent System         │ │
│  │  (原有接口)   │  │                                      │ │
│  └─────────────┘  │  ┌──────────────────────────────┐    │ │
│                    │  │     Supervisor (意图分类)      │    │ │
│                    │  │  使用 fast LLM 路由到子 Agent  │    │ │
│                    │  └──────┬───────┬────────┬───────┘    │ │
│                    │         │       │        │             │ │
│                    │    ┌────▼──┐ ┌──▼───┐ ┌─▼────┐       │ │
│                    │    │金融助手│ │研究Agent│ │预警Agent│   │ │
│                    │    │11 tools│ │10 tools│ │3 tools│     │ │
│                    │    └───┬───┘ └───┬───┘ └──┬───┘       │ │
│                    │        └────┬────┘        │            │ │
│                    │             ▼             ▼            │ │
│                    │     ┌─────────────────────────┐       │ │
│                    │     │       Tools 工具层        │       │ │
│                    │     │  股票 / 新闻 / KOL /     │       │ │
│                    │     │  组合 / 知识库 / 投资者    │       │ │
│                    │     └─────────┬───────────────┘       │ │
│                    └───────────────┼──────────────────────┘ │
│                                    ▼                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              现有服务层 (Services)                     │   │
│  │  YFinance / Finnhub / Benzinga / SnapTrade /        │   │
│  │  NewsAggregator / Supabase / Dataroma               │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                       │
                       ▼
          ┌────────────────────────┐
          │    LLM Providers       │
          │  OpenAI / Anthropic    │
          │  / Ollama (本地)       │
          └────────────────────────┘
```

### Supervisor 路由逻辑

```
用户消息
   │
   ▼
┌──────────────┐    fast LLM    ┌───────────────────┐
│ classify_    │───────────────▶│  判断意图:          │
│ intent       │                │  "financial"       │
│              │                │  "research"        │
│              │                │  "alert"           │
└──────────────┘                └────────┬──────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    ▼                    ▼                    ▼
          ┌─────────────┐     ┌──────────────┐     ┌─────────────┐
          │  Financial   │     │   Research    │     │    Alert     │
          │  Assistant   │     │    Agent      │     │    Agent     │
          │              │     │              │     │              │
          │ 日常问答:     │     │ 深度研究:     │     │ 预警相关:     │
          │ "AAPL多少钱"  │     │ "分析NVDA"   │     │ "设置提醒"    │
          │ "最近有啥新闻" │     │ "研究报告"    │     │ "监控股价"    │
          │ "我的持仓"    │     │ "深度分析"    │     │              │
          └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
                 │                    │                     │
                 └────────────────────┼─────────────────────┘
                                      ▼
                               ┌──────────┐
                               │   END    │
                               │ 返回回复  │
                               └──────────┘
```

### 子 Agent 内部 ReAct 循环

每个子 Agent 内部使用 LangGraph 的 `create_react_agent`，遵循 **ReAct** 模式：

```
┌─────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  用户    │────▶│  思考     │────▶│  行动     │────▶│  观察     │
│  消息    │     │ (Reason) │     │  (Act)   │     │(Observe) │
└─────────┘     └──────────┘     └──────────┘     └────┬─────┘
                     ▲                                   │
                     │           还需要更多数据？           │
                     └───────────── Yes ────────────────┘
                                    │
                                   No
                                    │
                                    ▼
                              ┌──────────┐
                              │  最终回复  │
                              └──────────┘
```

**示例：Research Agent 处理 "帮我分析 NVDA"**

```
思考: 用户要分析 NVDA，我需要收集多维度数据
行动: 调用 get_stock_quote("NVDA")        → 获取实时价格
观察: NVDA $875.28, +2.3%, 市值 2.15T

思考: 需要看基本面
行动: 调用 get_stock_financials("NVDA")   → 获取财务数据
观察: PE 65.2, 收入增长 122%, 利润率 55.6%

思考: 看看分析师怎么说
行动: 调用 get_analyst_recommendations("NVDA") → 获取评级
观察: 买入 35, 持有 8, 卖出 2, 目标价 $950

思考: 看看 KOL 的看法
行动: 调用 analyze_kol_sentiment("NVDA")  → 聚合 KOL 情感
观察: 正面 68%, 负面 12%, 中性 20%

思考: 检查最近新闻
行动: 调用 search_stock_news("NVDA")      → 搜索新闻
观察: 3 条新闻关于 AI 芯片需求增长

思考: 看看大佬持仓
行动: 调用 get_superinvestor_holdings(ticker="NVDA")
观察: 15 家对冲基金持有

思考: 数据齐全了，生成报告
最终回复: [结构化研究报告，包含以上所有维度分析]
```

---

## 目录结构

```
app/agent/
├── __init__.py              # 模块入口，暴露 run_agent, stream_agent
├── config.py                # 配置参数（系统提示词、超时、上下文窗口）
├── llm.py                   # 多 Provider LLM 工厂（OpenAI/Anthropic/Ollama）
├── state.py                 # LangGraph AgentState 类型定义
├── memory.py                # 对话记忆（Supabase 加载/保存 + LangChain 格式转换）
├── README.md                # 本文档
├── tools/                   # 工具层 - 封装现有服务
│   ├── __init__.py          # 工具注册表 + 各 Agent 工具子集
│   ├── stock_tools.py       # 股票数据工具 (5 个)
│   ├── news_tools.py        # 新闻搜索工具 (2 个)
│   ├── kol_tools.py         # KOL 分析工具 (2 个)
│   ├── portfolio_tools.py   # 投资组合工具 (1 个)
│   └── search_tools.py      # 知识库/投资者搜索工具 (2 个)
└── graphs/                  # 图定义层 - LangGraph 图
    ├── __init__.py
    ├── supervisor.py         # Supervisor 总控图 + run_agent / stream_agent
    ├── financial.py          # 金融助手子图
    ├── research.py           # 研究 Agent 子图
    └── alert.py              # 预警 Agent 子图
```

---

## 核心模块详解

### 1. LLM Factory (`llm.py`)

**作用：** 统一管理多个 LLM Provider，一行代码切换模型。

**支持的 Provider：**

| Provider | 模型示例 | 用途 |
|----------|---------|------|
| OpenAI | `gpt-4o`, `gpt-4o-mini` | 主力模型，工具调用能力强 |
| Anthropic | `claude-3-5-sonnet`, `claude-3-haiku` | 分析能力强，性价比高 |
| Ollama | `gemma2:2b`, `llama3` | 本地部署，隐私/离线场景 |

**关键函数：**

```python
# 获取主 LLM（根据 .env 配置）
llm = get_llm()

# 获取快速 LLM（意图分类用，成本低）
fast_llm = get_fast_llm()

# 自定义指定 provider 和模型
llm = get_llm(provider="anthropic", model="claude-3-5-sonnet-20241022")
```

**Fallback 机制：** 如果主 Provider 失败（如 API Key 过期），自动切换到配置的备用 Provider：

```
主: OpenAI/gpt-4o-mini → 失败 → 备用: Ollama/gemma2:2b → 成功
```

### 2. Agent State (`state.py`)

**作用：** 定义在整个 LangGraph 图中流转的状态数据。

```python
class AgentState(TypedDict):
    messages: Annotated[list, add_messages]  # 消息历史（LangGraph 自动合并）
    user_id: str                              # 当前用户 ID
    conversation_id: str                      # 当前对话 ID
    current_agent: str                        # 当前活跃的子 Agent
    metadata: Dict[str, Any]                  # 额外元数据
```

- `messages` 使用 LangGraph 的 `add_messages` 注解，新消息会自动追加而非覆盖
- `current_agent` 由 Supervisor 的 classify 节点设置，决定路由方向

### 3. Tools 工具层

**核心思想：** 不重写任何业务逻辑，只是把现有服务封装成 LangGraph 工具。

每个工具使用 `@tool` 装饰器定义，LLM 通过函数名和 docstring 决定何时调用。

#### 工具清单

| 工具名 | 文件 | 封装的服务 | 功能 |
|--------|------|-----------|------|
| `get_stock_quote` | stock_tools.py | YFinanceService.get_quote() | 实时股价、涨跌幅、成交量、市值 |
| `get_stock_financials` | stock_tools.py | YFinanceService.get_financials() | PE、利润率、收入增长、资产负债 |
| `get_analyst_recommendations` | stock_tools.py | YFinanceService.get_analyst_recommendations() | 分析师评级、目标价 |
| `get_stock_history` | stock_tools.py | YFinanceService.get_history() | 历史价格数据 |
| `get_company_info` | stock_tools.py | YFinanceService.get_company_info() | 公司概况、行业、简介 |
| `search_stock_news` | news_tools.py | NewsAggregator.aggregate_news() | 搜索某只股票的最新新闻 |
| `get_trending_news` | news_tools.py | NewsAggregator.get_trending_news() | 获取热门金融新闻 |
| `get_kol_latest_tweets` | kol_tools.py | Supabase kol_tweets 表 | 查询 KOL 最新推文 |
| `analyze_kol_sentiment` | kol_tools.py | Supabase kol_tweets 表 | 聚合某股票的 KOL 情感 |
| `get_user_portfolio` | portfolio_tools.py | Supabase snaptrade_positions 表 | 用户持仓、权重、盈亏 |
| `search_knowledge_base` | search_tools.py | Supabase 多表全文搜索 | KOL推文/新闻/小红书 搜索 |
| `get_superinvestor_holdings` | search_tools.py | Supabase dataroma 表 | 对冲基金持仓查询 |

#### 工具分配

不同的子 Agent 拥有不同的工具子集，避免无关工具干扰决策：

| Agent | 工具数 | 说明 |
|-------|-------|------|
| Financial Assistant | 11 | 全面工具集（不含 history） |
| Research Agent | 10 | 侧重数据采集（含 history，不含 portfolio） |
| Alert Agent | 3 | 轻量级（quote + news + kol） |

### 4. Graphs 图定义层

#### Supervisor (`supervisor.py`)

**入口图**，负责：

1. **意图分类** — 用 fast LLM（gpt-4o-mini / claude-3-haiku）快速判断用户意图
2. **条件路由** — 根据分类结果分发到对应子 Agent
3. **提供公共 API** — `run_agent()` 和 `stream_agent()`

**路由规则：**

| 用户意图 | 路由到 | 示例 |
|---------|-------|------|
| 日常金融问答 | Financial | "AAPL 多少钱"、"最近有什么新闻"、"我的持仓" |
| 深度研究分析 | Research | "帮我分析 NVDA"、"出个 TSLA 研究报告"、"深入分析苹果" |
| 监控预警 | Alert | "AAPL 跌到 200 提醒我"、"监控这只股票" |

#### Financial Assistant (`financial.py`)

通用金融助手，使用 ReAct 模式处理大部分日常查询。特点：
- 有 11 个工具，覆盖所有数据源
- 最多 20 轮工具调用
- 回答平衡，会同时给出看多和看空观点

#### Research Agent (`research.py`)

深度研究 Agent，适合需要多维度分析的场景。特点：
- 有 10 个研究型工具
- 最多 30 轮工具调用（研究需要更多步骤）
- 会按步骤收集数据：基本面 → 分析师 → KOL → 新闻 → 大佬持仓
- 输出结构化报告

#### Alert Agent (`alert.py`)

预警相关 Agent。特点：
- 只有 3 个轻量工具
- 帮助用户分析是否需要设置预警
- 可检查当前价格水平，推荐预警阈值

### 5. Memory 记忆层 (`memory.py`)

**作用：** 实现对话持久化记忆，Agent 能"记住"之前说过什么。

**工作流程：**

```
1. 用户发送消息
2. save_message() → 写入 Supabase chat_messages 表
3. load_conversation_history() → 从数据库读取最近 20 条消息
4. db_messages_to_langchain() → 转换为 LangChain 消息格式
5. 传给 Agent 作为上下文
6. Agent 生成回复
7. save_message() → 保存 AI 回复到数据库
```

**上下文窗口管理：** 默认加载最近 **20 条消息**（`MAX_CONTEXT_MESSAGES`），避免超出 LLM 上下文限制。

---

## 请求处理流程

### 同步模式 (`/send`)

```
客户端                FastAPI               Agent System              Supabase
  │                     │                       │                       │
  │  POST /send         │                       │                       │
  │  {content: "..."}   │                       │                       │
  │────────────────────▶│                       │                       │
  │                     │  save_message(user)   │                       │
  │                     │──────────────────────────────────────────────▶│
  │                     │                       │                       │
  │                     │  load_history()        │                       │
  │                     │──────────────────────────────────────────────▶│
  │                     │◀──────────────────────────────────────────────│
  │                     │                       │                       │
  │                     │  run_agent(messages)   │                       │
  │                     │──────────────────────▶│                       │
  │                     │                       │  classify intent      │
  │                     │                       │  route to sub-agent   │
  │                     │                       │  ReAct loop:          │
  │                     │                       │    think → tool → obs │
  │                     │                       │    think → tool → obs │
  │                     │                       │    ...                │
  │                     │                       │  final response       │
  │                     │◀──────────────────────│                       │
  │                     │                       │                       │
  │                     │  save_message(assistant)                      │
  │                     │──────────────────────────────────────────────▶│
  │                     │                       │                       │
  │  {message, response}│                       │                       │
  │◀────────────────────│                       │                       │
```

### 流式模式 (`/stream`, SSE)

```
客户端                FastAPI               Agent System
  │                     │                       │
  │  POST /stream       │                       │
  │────────────────────▶│                       │
  │                     │  stream_agent()       │
  │                     │──────────────────────▶│
  │                     │                       │
  │  data: {type:"tool_start", tool:"get_stock_quote"}
  │◀────────────────────│◀──────────────────────│
  │                     │                       │
  │  data: {type:"tool_end", tool:"get_stock_quote"}
  │◀────────────────────│◀──────────────────────│
  │                     │                       │
  │  data: {type:"token", content:"NVDA"}       │
  │◀────────────────────│◀──────────────────────│
  │  data: {type:"token", content:" 当前"}       │
  │◀────────────────────│◀──────────────────────│
  │  data: {type:"token", content:"价格"}        │
  │◀────────────────────│◀──────────────────────│
  │  ...逐 token 返回...  │                       │
  │                     │                       │
  │  data: {type:"done", message_id:"uuid"}     │
  │◀────────────────────│                       │
```

**SSE 事件类型：**

| type | 说明 | 数据 |
|------|------|------|
| `token` | AI 回复的文本片段 | `{content: "文本"}` |
| `tool_start` | Agent 开始调用工具 | `{tool: "get_stock_quote"}` |
| `tool_end` | 工具调用完成 | `{tool: "get_stock_quote"}` |
| `done` | 流式完成 | `{message_id: "uuid"}` |
| `error` | 发生错误 | `{content: "错误信息"}` |

---

## API 接口说明

所有接口需要 `Authorization: Bearer <token>` 认证头。

### 新增的 Agent 接口

#### `POST /api/v1/chat/conversations/{conversation_id}/send`

**同步发送消息并获取 AI 回复**

请求体：
```json
{
  "content": "NVDA 现在多少钱？最近有什么新闻？"
}
```

响应体：
```json
{
  "message": {
    "id": "msg-uuid-1",
    "conversation_id": "conv-uuid",
    "role": "user",
    "content": "NVDA 现在多少钱？最近有什么新闻？",
    "created_at": "2026-02-08T12:00:00Z"
  },
  "response": {
    "id": "msg-uuid-2",
    "conversation_id": "conv-uuid",
    "role": "assistant",
    "content": "NVDA (英伟达) 当前价格 $875.28，今日上涨 +2.3%...\n\n最近新闻：\n1. ...",
    "created_at": "2026-02-08T12:00:05Z"
  }
}
```

#### `POST /api/v1/chat/conversations/{conversation_id}/stream`

**流式发送消息（SSE）**

请求体（同上）：
```json
{
  "content": "帮我深入分析一下 TSLA"
}
```

响应（SSE 事件流）：
```
data: {"type":"tool_start","tool":"get_stock_quote"}
data: {"type":"tool_end","tool":"get_stock_quote"}
data: {"type":"tool_start","tool":"get_stock_financials"}
data: {"type":"tool_end","tool":"get_stock_financials"}
data: {"type":"token","content":"# TSLA "}
data: {"type":"token","content":"研究报告"}
data: {"type":"token","content":"\n\n## "}
data: {"type":"token","content":"价格概况"}
...
data: {"type":"done","message_id":"msg-uuid-2"}
```

### 保留的原有接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/conversations` | 获取对话列表 |
| POST | `/conversations` | 创建新对话 |
| GET | `/conversations/{id}` | 获取对话详情 |
| PATCH | `/conversations/{id}` | 更新对话标题 |
| DELETE | `/conversations/{id}` | 删除对话 |
| DELETE | `/conversations` | 删除所有对话 |
| POST | `/conversations/{id}/messages` | 添加原始消息（不触发 AI） |
| GET | `/conversations/{id}/messages` | 获取所有消息 |

---

## 配置与部署

### 环境变量

在 `.env` 文件中添加：

```bash
# ========== LLM Provider 配置 ==========

# 主 LLM Provider（三选一：openai / anthropic / ollama）
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini
LLM_TEMPERATURE=0.7

# 备用 LLM（可选，主 Provider 失败时自动切换）
LLM_FALLBACK_PROVIDER=ollama
LLM_FALLBACK_MODEL=gemma2:2b

# ========== API Keys ==========

# OpenAI（如果 LLM_PROVIDER=openai）
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx

# Anthropic（如果 LLM_PROVIDER=anthropic）
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxx

# Ollama（如果 LLM_PROVIDER=ollama，默认本地）
OLLAMA_BASE_URL=http://localhost:11434
```

### 依赖安装

```bash
cd kolvex-backend-py
source venv/bin/activate
pip install -r requirements.txt
```

新增的依赖（已添加到 requirements.txt）：

```
langgraph>=0.2.0
langchain-core>=0.3.0
langchain-openai>=0.2.0
langchain-anthropic>=0.2.0
langchain-ollama>=0.2.0
langchain-community>=0.3.0
```

### 推荐配置组合

| 场景 | Provider | Model | 说明 |
|------|----------|-------|------|
| 生产环境（推荐） | openai | gpt-4o-mini | 性价比最高，工具调用稳定 |
| 高质量分析 | openai | gpt-4o | 更好的推理能力 |
| 成本敏感 | anthropic | claude-3-haiku | 便宜且快速 |
| 深度分析 | anthropic | claude-3-5-sonnet | 分析能力最强 |
| 本地/隐私 | ollama | gemma2:2b | 无需 API Key，完全本地 |
| 本地高质量 | ollama | llama3:8b | 本地最佳质量 |

---

## 使用示例

### 典型对话场景

**场景 1：查股价（→ Financial Agent）**
```
用户: AAPL 现在多少钱
Agent: [调用 get_stock_quote("AAPL")]
      苹果 (AAPL) 当前价格 $187.52，今日下跌 -0.8%...
```

**场景 2：看新闻（→ Financial Agent）**
```
用户: 最近有什么重要的科技股新闻
Agent: [调用 get_trending_news()]
      以下是今日热门科技股新闻：
      1. NVDA: AI 芯片需求持续强劲...
      2. MSFT: Azure 收入增长 29%...
```

**场景 3：KOL 观点（→ Financial Agent）**
```
用户: KOL 们怎么看 TSLA
Agent: [调用 analyze_kol_sentiment("TSLA")]
       [调用 get_kol_latest_tweets(ticker="TSLA")]
      TSLA 的 KOL 情感分析：
      - 看多: 45% | 看空: 30% | 中性: 25%
      - @analyst_A: "自动驾驶进展超预期..."
      - @trader_B: "估值偏高，建议观望..."
```

**场景 4：深度研究（→ Research Agent）**
```
用户: 帮我出一份 NVDA 的研究报告
Agent: [调用 get_stock_quote("NVDA")]
       [调用 get_stock_financials("NVDA")]
       [调用 get_analyst_recommendations("NVDA")]
       [调用 analyze_kol_sentiment("NVDA")]
       [调用 search_stock_news("NVDA")]
       [调用 get_superinvestor_holdings(ticker="NVDA")]

      # NVDA 研究报告

      ## 执行摘要
      NVDA 当前价格 $875，分析师目标价 $950...

      ## 基本面分析
      PE 65.2，收入 YoY +122%，利润率 55.6%...

      ## 市场情感
      KOL 看多比例 68%，近期新闻正面...

      ## 机构持仓
      15 家对冲基金持有，最大持仓...

      ## 风险因素
      1. 估值偏高...
      2. AI 支出周期性...

      ## 结论
      看多: ... | 看空: ...
```

**场景 5：查持仓（→ Financial Agent）**
```
用户: 我的持仓怎么样
Agent: [调用 get_user_portfolio(user_id)]
      您的投资组合总价值 $52,380：
      - NVDA: 30 股, $26,258 (50.1%)  +15.2%
      - AAPL: 50 股, $9,376 (17.9%)   +3.8%
      - ...
```

**场景 6：超级投资者（→ Financial Agent）**
```
用户: 巴菲特最近买了什么
Agent: [调用 get_superinvestor_holdings(investor_name="Warren Buffett")]
      Warren Buffett (Berkshire Hathaway) 最新持仓：
      1. AAPL - 占比 49.2%
      2. BAC - 占比 8.9%
      ...
```

---

## 扩展指南

### 添加新工具

1. 在 `tools/` 下创建或编辑文件：

```python
# tools/my_new_tools.py
from langchain_core.tools import tool

@tool
def my_new_tool(param1: str, param2: int = 10) -> str:
    """工具描述 - LLM 根据这段文字决定何时调用。

    Args:
        param1: 参数1说明
        param2: 参数2说明

    Returns:
        JSON string with results
    """
    # 调用现有服务
    result = some_existing_service.do_something(param1)
    return json.dumps(result)
```

2. 在 `tools/__init__.py` 中注册：

```python
from app.agent.tools.my_new_tools import my_new_tool

ALL_TOOLS = [..., my_new_tool]
FINANCIAL_TOOLS = [..., my_new_tool]  # 按需分配到子 Agent
```

### 添加新的子 Agent

1. 在 `graphs/` 下创建新图：

```python
# graphs/portfolio_advisor.py
from langgraph.prebuilt import create_react_agent
from app.agent.llm import get_llm

PORTFOLIO_SYSTEM_PROMPT = "..."

def create_portfolio_advisor():
    return create_react_agent(
        model=get_llm(),
        tools=[...],
        prompt=PORTFOLIO_SYSTEM_PROMPT,
    )
```

2. 在 `supervisor.py` 中注册节点和路由：

```python
# 添加节点
workflow.add_node("portfolio", run_portfolio_agent)

# 更新路由
workflow.add_conditional_edges("classify", route_to_agent, {
    "financial": "financial",
    "research": "research",
    "alert": "alert",
    "portfolio": "portfolio",  # 新增
})

workflow.add_edge("portfolio", END)
```

3. 更新 `ROUTER_SYSTEM_PROMPT` 添加新的路由选项。

### 切换 LLM Provider

只需修改 `.env`，无需改代码：

```bash
# 从 OpenAI 切换到 Anthropic
LLM_PROVIDER=anthropic
LLM_MODEL=claude-3-5-sonnet-20241022
ANTHROPIC_API_KEY=sk-ant-xxx
```

### 调整 Agent 行为

修改 `config.py` 中的参数：

```python
MAX_CONTEXT_MESSAGES = 20   # 增大 = 更多历史记忆，但更耗 token
MAX_TOOL_ITERATIONS = 10    # 增大 = Agent 可以做更多步骤，但更慢
AGENT_TIMEOUT = 120.0       # 超时秒数
LLM_TEMPERATURE = 0.7       # 降低 = 更确定性的回答
```
