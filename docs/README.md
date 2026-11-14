# Kolvex 文档索引

> 给 AI 和人看的文档总目录。入口规则见根目录 [AGENTS.md](../AGENTS.md)。
> 用法：先在「任务路由」里找到要读的文档，只读相关的那几份。

## 1. 文档分层

| 层 | 位置 | 内容 | 什么时候读 |
| --- | --- | --- | --- |
| 入口 | [`/AGENTS.md`](../AGENTS.md) | 项目地图、硬性规则、完成标准 | 每次 |
| 跨项目规范 | [`docs/engineering/`](engineering/) | 开发规范、Web↔App 移植规范 | 写代码前 |
| 产品 / 功能 | [`docs/product/feature-catalog.md`](product/feature-catalog.md) + `docs/<功能>.md` | 功能总表、每个功能的需求和实现边界 | 改某个功能前 |
| 设计 | [`docs/design/design-system.md`](design/design-system.md) + 各端 `DESIGN.md` | 跨端设计原则、token、组件归属 | 改界面前 |
| 各端规则 | `kolvex-mobile/AGENTS.md`、`kolvex-frontend-web-nextjs/CLAUDE.md`、`kolvex-backend-py/README.md` | 单个项目的命令和约束 | 进入该项目时 |

## 2. 事实来源优先级

文档会过时。冲突时按这个顺序相信（越靠前越可信），并在交付时指出冲突：

1. **运行时代码**：`lib/productFeatures.ts`（功能开关）、`app/globals.css`（颜色 token）、`app/api/routes/__init__.py`（已注册的后端接口）、路由文件本身
2. **会失败的测试**：`kolvex-mobile/tests/*-parity.test.ts`、`kolvex-frontend-web-nextjs/scripts/*.test.cjs`、`kolvex-backend-py/tests/`
3. **本目录的规范文档**（`docs/engineering`、`docs/design`、`docs/product`）
4. 单功能文档（`docs/<功能>.md`、`docs/<功能>/`）
5. 各端 `PRODUCT.md` / `DESIGN.md` / `UX-CONTRACT.md` / `MIGRATION.md`
6. 历史记录：`PROGRESS.md`、`artifacts/`、`.impeccable/`（只做参考，经常已过时）

## 3. 任务路由

| 任务 | 读这些 |
| --- | --- |
| 写任何代码 | [engineering/development-standards.md](engineering/development-standards.md) |
| 新功能 / 改功能 | [product/feature-catalog.md](product/feature-catalog.md) → 该功能的文档 |
| 改 Web 界面 | [design/design-system.md](design/design-system.md) → `kolvex-frontend-web-nextjs/DESIGN.md` 相关章节 → `kolvex-frontend-web-nextjs/CLAUDE.md`（文案规则） |
| 改 App 界面 | [design/design-system.md](design/design-system.md) → `kolvex-mobile/DESIGN.md` → `kolvex-mobile/UX-CONTRACT.md` |
| Web → App 移植 | [engineering/web-mobile-parity.md](engineering/web-mobile-parity.md) → `kolvex-mobile/MIGRATION.md` → `kolvex-mobile/.agents/PORTING.md` |
| 改 App 里的 Expo / RN 代码 | `kolvex-mobile/AGENTS.md` |
| 改后端接口 / 服务 | `kolvex-backend-py/README.md` → 功能文档 |
| 改 AI 聊天 Agent | `kolvex-backend-py/app/agent/README.md`、[model-catalog.md](model-catalog.md) |
| 改数据加载 / 缓存 / 刷新 | [frontend-data-cache.md](frontend-data-cache.md)、[loading-states.md](loading-states.md)、[market-data-freshness-20261104.md](market-data-freshness-20261104.md) |
| 改 CI、代码风格 | `.github/CICD_SETUP.md` |
| 部署 / 数据库迁移 | `.github/CICD_SETUP.md`、[supabase-ai-analysis-deployment.md](supabase-ai-analysis-deployment.md)、`kolvex-backend-py/docs/supabase-egress-audit.md` |

## 4. 全部文档目录

### 跨项目规范（本次新增）

| 文档 | 内容 |
| --- | --- |
| [engineering/development-standards.md](engineering/development-standards.md) | 开发流程、代码规范、测试、提交、安全 |
| [engineering/web-mobile-parity.md](engineering/web-mobile-parity.md) | Web 与 App 之间移植的规则和检查清单 |
| [product/feature-catalog.md](product/feature-catalog.md) | 所有功能 × 三端实现位置 × 文档 × 状态；通用功能要求 |
| [design/design-system.md](design/design-system.md) | 跨端设计原则、token 归属、组件对照、状态与文案规则 |

### 功能文档

| 文档 | 功能 |
| --- | --- |
| [decision-workspace.md](decision-workspace.md) | 股票信息工作台（行情 + 观点 + AI + 持仓） |
| [stock-discovery.md](stock-discovery.md) | 股票观察列表（今日异动 / 放量活跃 / 博主热议…） |
| [stock-valuation/PRD.md](stock-valuation/PRD.md) · [README.md](stock-valuation/README.md) | 股票估值（PRD + 开发记录） |
| [technical-analysis-focus.md](technical-analysis-focus.md) | 技术分析关注点 |
| [market-events.md](market-events.md) · [market-events.schema.json](market-events.schema.json) | 重大事件日历 |
| [market-data-freshness-20261104.md](market-data-freshness-20261104.md) | 报价同步检查记录 |
| [watchlist-sync.md](watchlist-sync.md) | 账户自选股同步 |
| [news-feed.md](news-feed.md) | 新闻终端 |
| [daily-briefs.md](daily-briefs.md) · [prompts/daily-brief-generator.md](prompts/daily-brief-generator.md) | 早晚报导入与生成提示词 |
| [x-content.md](x-content.md) | X 博主内容 |
| [youtube-channel-profiles.md](youtube-channel-profiles.md) | YouTube 博主主页 |
| [public-reading.md](public-reading.md) | 未登录公开阅读页与 SEO |
| [paper-trading/PLAN.md](paper-trading/PLAN.md) · [README.md](paper-trading/README.md) | 虚拟交易（规划 + 运行验证） |
| [model-catalog.md](model-catalog.md) | 可选 AI 模型目录 |
| [mcp-content-admin.md](mcp-content-admin.md) | 内容管理 MCP 服务 |
| `kolvex-backend-py/docs/macro-data.md` | 宏观指标 |
| `kolvex-backend-py/app/agent/README.md` | LangGraph AI Agent |

### 横切技术文档

| 文档 | 内容 |
| --- | --- |
| [frontend-data-cache.md](frontend-data-cache.md) | Web 读缓存 `clientCache` |
| [loading-states.md](loading-states.md) | 加载状态规范 |
| [supabase-ai-analysis-deployment.md](supabase-ai-analysis-deployment.md) | AI 分析的 Supabase 部署核验 |
| `kolvex-backend-py/docs/supabase-egress-audit.md` | Supabase 出口流量排查 |
| `.github/CICD_SETUP.md` | CI/CD、代码风格 pipeline、部署 |

### 各端文档

| 项目 | 文档 |
| --- | --- |
| Web | `PRODUCT.md`（产品定位与功能描述）· `DESIGN.md`（设计系统，1800+ 行，按章节读）· `UX-CONTRACT.md`（交互归属）· `CLAUDE.md`（界面文案规则）· `README.md` · `docs/research/finsepa-stock-ui.md` |
| App | `AGENTS.md`（Expo 规则）· `.agents/PORTING.md`（移植操作手册）· `MIGRATION.md`（移植台账）· `DESIGN.md` · `UX-CONTRACT.md` · `VERIFICATION.md`（验证记录）· `README.md` |
| 后端 | `README.md` · `QUICKSTART.md` |

## 5. 已知文档漂移（待人工确认）

发现文档与代码不一致、但当次不修时，记在这里。以代码为准；修正文档后删掉对应行。

| 文档 | 问题 | 代码事实 |
| --- | --- | --- |
| — | 目前没有已知漂移（2026-11-13 核对并修正了 FEATURE_INVENTORY、根 README 中英文版、后端 README、App MIGRATION、Web DESIGN frontmatter） | — |

## 6. 文档维护规则

- **功能变了，文档同一次改**：改功能行为时，同一个改动里更新功能文档和 [feature-catalog.md](product/feature-catalog.md) 对应行。
- **新功能先建文档**：新功能在 `docs/<功能名>.md` 新建文档（模板见 [feature-catalog.md](product/feature-catalog.md#新功能文档模板)），并在本索引和功能总表各加一行。
- **一件事只写在一处**：规则写在最合适的那份文档里，其他地方只放链接。根 `AGENTS.md` 只放每次都要用的内容。
- **写事实，不写愿望**：已验证和未验证分开写；没验证的明确写「未验证」。
- **路径用仓库相对路径**，方便 AI 直接打开。
- 发现漂移但当次不修：加到上面「已知文档漂移」表里。
