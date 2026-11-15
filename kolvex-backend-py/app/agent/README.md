# Kolvex AI 聊天 Agent

> 2026-11-15 按代码重写。文档和代码冲突时以代码为准，并更新本文件。
> 本文件只覆盖 AI 聊天（`/api/v1/chat`）和研究工作区借用的工具。AI 研究报告库是另一套系统，见文末「和 AI 研究报告的关系」。

## 1. 它做什么

用户在 Web / App 的 AI 聊天里提问，后端用 LangGraph 的 ReAct Agent 回答：模型自己决定调用哪些工具取实时数据，再组织成回答。

- **路由**：每轮先判断意图，分给两个子 Agent 之一。两者工具相同，区别只在提示词。
  - `financial`：问答、查数字。提示词要求第一句给答案，查一两个数字时不超过约 150 词。
  - `research`：深度分析、多空、「该不该买」，提示词要求多步取数、写结构化报告。
- **数字核对**：报价、营收、财务指标都从工具结果里抽成 evidence，答案里的数字逐个对照（见第 5 节）。
- **多模型**：用户可选模型，也可以填自己的 API key（见第 6 节）。

## 2. 一轮请求怎么走

入口：`app/api/routes/chat/routes.py` → `graphs/supervisor.py`。

1. 保存用户消息（重试同一问题时复用上一条未回答的消息，`memory.save_user_message_once`）。
2. 加载本对话摘要之后的消息（`memory.load_conversation_history`），以及对话摘要和跨对话记忆（`chat_memory.load_memory_note`，拼进系统提示词末尾），见第 7 节。
3. 读用户自己的 API key。
4. `_classify_intent`：先用关键词正则（`route_by_keywords`），明确的「研报 / 深度 / 该不该买」→ research，80 字以内的查数问题 → financial；判断不出来才调一次快模型。快模型回答里没有 `research` 一律按 financial。
5. `_create_agent_for_request`：按用户选的模型、数据源、技能拼出工具集和提示词，`create_react_agent` 每轮新建。最多 `MAX_TOOL_ITERATIONS`（10）轮工具调用。
6. 跑 Agent，收集 evidence，修单位错误，核对数字，保存助手消息。
7. 回复保存后在后台更新记忆（`chat_memory.remember_turn_later`），不拖慢回复；回复失败的轮次不记。

### 接口

| 接口 | 说明 |
| --- | --- |
| `POST /api/v1/chat/conversations/{id}/send` | 同步，返回完整回复 |
| `POST /api/v1/chat/conversations/{id}/stream` | SSE 流式；`continue_on_disconnect=true` 时断开连接也继续生成 |
| `GET /api/v1/chat/memory` | 查看跨对话记忆：常用语言、查得最多的股票 |
| `DELETE /api/v1/chat/memory` | 清除跨对话记忆 |
| `GET` / `DELETE /api/v1/chat/conversations/{id}/stream` | 查询 / 停止正在进行的一轮 |
| 其余 `/conversations` 接口 | 对话的增删改查，不涉及 Agent |

### 流式事件（`stream_agent`）

| `type` | 含义 |
| --- | --- |
| `status` | 阶段：`routing` → `planning` → `writing` |
| `token` | 回答文字片段 |
| `token_reset` | 撤回刚才的片段：模型写了几个字后决定去调工具 |
| `tool_start` / `tool_end` | 工具开始 / 结束，带工具名；前端按工具名显示中英文进度文案 |
| `done` | 结束，带 `quote_evidence`、`revenue_evidence`、`financial_evidence`、`data_gaps`、`scaled_figures` |
| `error` | 失败。异常原文只写日志，不发给用户 |

## 3. 工具

以 `tools/__init__.py` 的 `AGENT_TOOLS` 为准。financial 和 research 用同一套。

| 工具名 | 文件 | 数据来源 | 技能开关 | 功能 |
|--------|------|---------|---------|------|
| `get_stock_quote` | stock_tools.py | Finnhub / yfinance | market | 实时股价、涨跌幅、报价时间 |
| `get_stock_history` | stock_tools.py | yfinance | market | 历史 K 线（最多 60 根） |
| `get_technical_indicators` | technical_tools.py | yfinance 日线（2 年） | market | EMA 20/50/200、RSI14、ATR14、相对成交量、一年高低点、支撑 / 阻力，见下 |
| `get_stock_financials` | stock_tools.py | yfinance | fundamentals | PE、利润率、增长等指标 |
| `get_reported_revenue` | stock_tools.py | SEC XBRL，退回 Yahoo | fundamentals | 直接申报的季度 / 年度营收、同比 |
| `get_analyst_recommendations` | stock_tools.py | yfinance | fundamentals | 分析师评级、目标价 |
| `get_company_info` | stock_tools.py | yfinance | fundamentals | 公司概况、行业 |
| `get_options_chain_summary` | options_tools.py | 期权链服务 | options | 期权链摘要 |
| `get_creator_opinions` | creator_tools.py | `youtube_stock_opinions` | creators | 某只股票最近的博主观点（带视频链接） |
| `get_creator_record` | creator_tools.py | `youtube_stock_opinions` + yfinance 复权日线 | creators | 某位博主观点发布后股价相对 SPY 的表现，见下 |
| `get_daily_brief` | brief_tools.py | Kolvex 日报 | news | 最新日报 |
| `search_news_flashes` | news_flash_tools.py | 快讯 | news | 按关键词 / 股票搜快讯 |
| `web_search` | web_tools.py | Tavily | news（且开启 Web 数据源） | 网页搜索 |
| `get_user_portfolio` | portfolio_tools.py | 用户持仓 | portfolio（且开启 Portfolio 数据源） | 持仓、权重、盈亏（按当前用户绑定） |
| `get_user_watchlist` | watchlist_tools.py | 用户自选股 | market（仅登录用户） | 自选股列表（按当前用户绑定） |

### 数据源和技能开关（`get_tools_for_sources`）

- `sources`：前端的数据源开关。`None` 表示全开；`web` 打开 `web_search`，`portfolio` / `plaid` 打开 `get_user_portfolio`。用户关掉的数据源不会被重新打开。
- `skills`：前端的技能开关（market / fundamentals / options / news / creators / portfolio）。`None` 不过滤；空列表表示一个工具都不给，提示词会要求模型说明没有查实时数据。

### `get_technical_indicators`（技术指标）

- 计算全在代码里，复用图表 AI 技术分析的函数（`app/services/technical_analysis.py` 的 `ema` / `rsi` / `atr` / `swing_points` / `candidate_levels`），**不调用模型**。
- 拉 2 年日线，EMA 用全部数据预热；摆动点、支撑阻力、高低点用最近 252 根。支撑 / 阻力各给离现价最近的 3 个，带触及次数和最后触及日期。
- 少于 30 根有效 K 线时返回 `no ...` 错误（记为「没有数据」）；数据不够算 EMA200 时该项为 `null`，不用 0。
- 用的是未复权日线，最后一根可能是当天未收盘的 K 线，返回里有说明。提示词要求只描述指标，不变成目标价或买卖建议。
- 测试：`tests/test_technical_tools.py`。

### `get_creator_record`（博主观点后股价）

- 输入：博主名称 / `@handle` / channel id，可选股票代码，回看天数（30–1095，默认 365；`null` 为全部）。名称先精确匹配、再模糊匹配；匹配到多位博主时返回 `status: "ambiguous"` 和候选名单，让模型追问，不算数据缺口。
- 计算：`app/services/creator_record.py`，方法和「回看」页相同（[docs/opinion-backtest.md](../../../docs/opinion-backtest.md)）：首个开盘价入场，5 / 20 个交易日，减去同期 SPY，7 天去重，看涨看跌分开。
- **只陈述事实**：不返回、提示词也禁止「说对 / 说错」、准确率、胜率、博主排名或博主之间比较。
- 样本门槛：一组至少 30 条、入场日期跨度至少 90 天才给平均数，并给前后两半各自的平均；不够时只给条数。
- 行情失败：单只股票失败计入 `price_unavailable`；全部失败返回错误，不用 0 代替。
- 测试：`tests/test_creator_record.py`。

### 研究工作区

`app/services/research_workspace.py` 的 `tools_for` 给每个研究员一小组工具（market：报价、K 线、技术指标、期权；creators：两个博主工具；等等），复用这里的工具函数，但有自己的提示词和流程。

### 加一个新工具要改的地方

1. `tools/<name>_tools.py` 里写 `@tool`，docstring 写清楚何时用、返回什么、回答规则。失败时返回 `{"error": ...}`：以 `no ` / `not found` 开头会被记为「没有数据」，其他记为「暂时不可用」（`data_gaps.py`）。
2. `tools/__init__.py`：加进 `AGENT_TOOLS` 和 `_CHAT_TOOL_SKILLS`（决定归哪个技能开关）。
3. `config.py` 的 `SYSTEM_PROMPT` 工具列表里写一行。
4. 前端进度文案（中英文都要）：Web `components/chat/types.ts` 的 `TOOL_LABELS`、`lib/i18n/locales/{en,zh}.json` 的 `chat.tools`、`components/chat/DataGapNote.tsx`。如果研究工作区也用：Web `WorkspacePanel.tsx` 的 `TOOL_COPY`，App `src/components/Workspace.tsx` 的 `TOOL_NAMES` + `translations/native-en.json`（再跑 `npm run i18n:generate`）。
5. 测试 + 本文件。

## 4. 提示词

| 位置 | 内容 |
| --- | --- |
| `config.py` `SYSTEM_PROMPT` | 两个子 Agent 共用：可用工具、回答原则、跟随用户语言，加上 `app/core/report_format.py` 的排版规则 |
| `graphs/financial.py` | financial 的角色说明 |
| `graphs/research.py` | research 的研究步骤；明确说聊天里不能启动 TradingAgents |
| `graphs/supervisor.py` | 路由提示词；按本轮可用工具追加的规则（报价时间、亿 / billion 换算、营收期间、技能被关时的说明）；financial 的 `ANSWER_SHAPE` |

## 5. 数字核对

模型抄错数字是聊天里最常见的错误，所以每轮都做：

- `quote_evidence.py` / `revenue_evidence.py` / `financial_evidence.py`：从本轮工具结果里抽出报价、营收、财务指标。报价和营收会作为卡片显示给用户。
- `unit_fix.py`：修「1,270.38 billion」被写成「1,270.38 亿」这类单位错误。
- `answer_check.py`：答案里的每个数字对照本轮 evidence，标为 matched / mismatch / unverified，只有 mismatch 会提示给用户。结果存在 `chat_messages.answer_check`。
- `data_gaps.py`：哪个工具没拿到数据、是暂时失败还是本来就没有，前端 `DataGapNote` 显示。

只认**本轮**工具结果：历史消息里的数字不算 evidence。这也是追问时会重新调工具的原因（见第 7 节）。

## 6. 模型（`llm.py`）

- 可选模型在 `MODEL_TO_PROVIDER`，前端选择见 [docs/model-catalog.md](../../../docs/model-catalog.md)。不在表里的模型 ID 按服务端默认（`LLM_PROVIDER` / `LLM_MODEL`）处理。
- 支持 OpenAI、Anthropic、Ollama，以及 OpenAI 兼容接口的 DeepSeek、Qwen、Gemini、Kimi、Grok（`OPENAI_COMPATIBLE_PROVIDERS`）。
- 用户自己的 key 优先于服务端 key。主模型创建失败时用 `LLM_FALLBACK_PROVIDER` / `LLM_FALLBACK_MODEL`。
- 路由用 `get_fast_llm`（各家的快模型）。
- DeepSeek / Kimi 要求工具调用轮次回传 `reasoning_content`，由 `thinking_chat.py` 的 `ThinkingChatOpenAI` 处理。

环境变量：`LLM_PROVIDER`、`LLM_MODEL`、`LLM_TEMPERATURE`、`LLM_FALLBACK_PROVIDER`、`LLM_FALLBACK_MODEL`、各家 `*_API_KEY`、`OLLAMA_BASE_URL`、`TAVILY_API_KEY`（不配则 `web_search` 返回错误）。密钥只在后端。

## 7. 记忆（`memory.py`、`chat_memory.py`）

需要迁移 `migrations/20261115000000_chat_memory.sql`（`chat_conversations` 加 `summary` / `summary_until` 两列，新表 `chat_user_memory`）。没跑迁移时一切照旧：只发最近 20 条消息，没有跨对话记忆，不报错。

**对话内：消息 + 滚动摘要**

- 每轮发给模型的是：摘要（如果有）+ `summary_until` 之后的全部消息，只取 `role` 和 `content`。
- 摘要之后的消息攒到 `SUMMARY_TRIGGER`（30）条时，回复保存后用快模型把除最新 20 条以外的消息并进摘要，`summary_until` 移到最后一条被并进去的消息。所以每 10 条消息（约 5 轮）才多一次快模型调用，模型每轮看到摘要 + 20～29 条原文。
- 摘要**不记任何数字**（价格、营收、比率、目标价）：第 5 节的核对只认本轮工具结果，记住的数字会过时也没法核对。需要数字时模型会重新调工具。
- 摘要失败（模型报错、数据库出错）只记日志，旧摘要不变，下一轮再试。
- 工具结果仍然不进历史，追问时重新调工具，原因同上。

**跨对话：`chat_user_memory`（每个用户一行）**

- `language`：用户最近一条语言明确的消息是中文还是英文（只有股票代码之类的消息不改它）。提示词里只在当前消息语言不明确时才用它。
- `tickers`：本轮工具调用参数里出现的股票代码，每轮每只记一次，按次数和最近日期排序，最多 40 只；提示词里给前 8 只，并写明这不是自选股也不是持仓，不要主动提起。
- 不调用模型，纯代码从用户消息和工具参数里取。
- 后端用 service role 写；RLS 只允许用户读和删自己的那一行。用户通过 `GET` / `DELETE /api/v1/chat/memory` 查看和清除；界面在 Web「设置 → 偏好设置 → AI 聊天记忆」（经 Next 路由 `/api/chat-history/memory` 转发）和 App 设置的偏好设置页（仅登录后显示），清除前都要二次确认。删除对话不会清除它。
- 用户说过的偏好（「回答短一点」「我做长线」）目前只会进这个对话的摘要，不会跨对话记住。

## 8. 目录

```
app/agent/
├── config.py            # 参数和共用系统提示词
├── llm.py               # 模型工厂、可选模型表
├── thinking_chat.py     # DeepSeek / Kimi 的 reasoning_content 兼容
├── memory.py            # 对话历史读写
├── chat_memory.py       # 对话摘要、跨对话记忆
├── graphs/
│   ├── supervisor.py    # 路由、按请求建 Agent、run_agent / stream_agent
│   ├── financial.py     # financial 提示词
│   └── research.py      # research 提示词
├── tools/               # 见第 3 节；trading_analysis_tools.py 未接入，见下
├── quote_evidence.py / revenue_evidence.py / financial_evidence.py
├── answer_check.py / unit_fix.py / data_gaps.py
```

## 9. 和 AI 研究报告的关系

AI 研究报告库（`/dashboard/ai-research`，功能开关 `tradingAnalysis`）**不走这个 Agent**。报告由开源多 Agent 框架 TradingAgents 生成：`app/services/trading_analysis_service.py` 在后台线程里跑，Redis 记录进度，结果存 Supabase，只有管理员能发起，生成后所有登录用户可读。

`tools/trading_analysis_tools.py` 里有一个把 TradingAgents 包成聊天工具的版本，但没有接入，因为：一次要跑好几分钟，会卡住聊天；绕过了 `TradingAnalysisService`，结果不保存、不进报告库；模型写死；而且等于让任何用户在聊天里触发一次很贵的多模型调用。research 提示词因此明确说聊天里不能启动它。

## 10. 测试

```bash
cd kolvex-backend-py
venv/bin/python -m pytest tests/test_chat_agent.py tests/test_technical_tools.py tests/test_creator_record.py \
  tests/test_answer_check.py tests/test_unit_fix.py tests/test_financial_evidence.py tests/test_chat_numbers_eval.py \
  tests/test_research_workspace.py
```
