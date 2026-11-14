# 开发规范

> 适用于 Web、App、后端三个项目。App 的 Expo 相关规则另见 `kolvex-mobile/AGENTS.md`，移植规则另见 [web-mobile-parity.md](web-mobile-parity.md)。

## 1. 工作流程

每个任务按这五步走：

1. **定位**：在 [feature-catalog.md](../product/feature-catalog.md) 找到功能所在行，确认 `productFeatures.ts` 里是否启用，找到三端的代码入口和功能文档。
2. **读现状**：先读现有实现和功能文档，沿用已有模式。同一种事已有做法的（数据加载、表单、弹窗、列表），复用它，不另起一套。
3. **小步改动**：只改任务需要的部分。不顺手重构无关代码，不顺手格式化无关文件（代码风格检查只查改动过的文件，见 §3）。
4. **验证**：跑 [AGENTS.md §4](../../AGENTS.md#4-完成标准definition-of-done) 里改动项目对应的检查。界面改动还要在真实界面里看过：Web 在浏览器里同时看桌面和 390px 手机宽度、浅色和深色；App 在模拟器里看。
5. **汇报**：写清改了哪些文件、跑了哪些检查（贴结果）、**哪些没验证**、另一端是否需要跟进、文档是否已更新。

## 2. 架构约定

### 请求链路

```
Web 浏览器 ──> Next.js /app/api/*（代理、缓存、鉴权转发）──> FastAPI /api/v1/*
App ─────────────────────────────────────────────────────> FastAPI /api/v1/*（EXPO_PUBLIC_API_URL）
                                                              │
                                              Supabase（Auth / Postgres / Storage）· Redis · 外部数据源
```

- 业务逻辑放在**后端**。Web 的 `app/api/*` 只做代理、缓存和格式适配，不复制业务规则。App 不经过 Next.js。
- 两端都需要的计算（指标公式、格式化、范围选择），优先放到后端返回。必须在前端算的，Web 版是参考实现，App 逐字复制并由 parity 测试守住（见 [web-mobile-parity.md](web-mobile-parity.md)）。
- 需要登录的接口用 `kolvex-backend-py/app/api/dependencies/auth.py` 里的依赖校验，管理员接口走管理员校验。不要在前端判断权限来代替后端校验。

### Web（`kolvex-frontend-web-nextjs/`）

| 放什么 | 放哪里 |
| --- | --- |
| 页面路由（保持薄，只组装组件） | `app/dashboard/<功能>/page.tsx`，公开页在 `app/(public)/` |
| 后端代理 | `app/api/<功能>/.../route.ts` |
| 功能组件 | `components/<领域>/`（如 `decision/`、`youtube/`、`paper-trading/`） |
| 通用 UI 原子组件 | `components/ui/`（Button、Card、ListCard、SegmentedControl、Select、Dialog、ContentLoading、InfoTip…）——**先找这里，没有再加** |
| 纯逻辑、API 客户端、类型 | `lib/<功能>.ts`、`lib/<功能>Api.ts` |
| 数据 hooks | `hooks/`（`useCachedResource`、`useVisiblePolling`、`useMarketQuotes`…） |
| 功能开关 | `lib/productFeatures.ts` |
| 文案 | `useCopy()`（`components/decision/shared.tsx`，就地写中英两份）或 `useTranslation()` + `lib/i18n/locales/{zh,en}.json` |
| 颜色、圆角等 token | `app/globals.css` → `tailwind.config.ts`。组件里用语义类名，不写死 hex |

数据加载：读请求用 `useCachedResource` / `clientCache`（见 [frontend-data-cache.md](../frontend-data-cache.md)），需要轮询时用 `useVisiblePolling`（页面不可见时暂停），首次加载用 `ContentLoading`（见 [loading-states.md](../loading-states.md)）。

### App（`kolvex-mobile/`）

| 放什么 | 放哪里 |
| --- | --- |
| 路由（保持薄） | `src/app/`。Tab 页在 `src/app/(tabs)/`，二级页在 `(tabs)/(more)/` 或独立 stack 路由 |
| 组件 | `src/components/<Feature>.tsx`；通用原子组件在 `src/components/UI.tsx`（`Copy`、`Glass`、`Page`、`ListPage`、`Button`、`Chip`、`LoadingStatus`、`Failure`…） |
| 纯逻辑、API 客户端 | `src/lib/` |
| iOS 原生 SwiftUI 包装 | `src/components/native/*.ios.tsx` |
| 颜色 | `src/lib/palette.ts`（由 `tests/theme-parity.test.ts` 对照 Web `globals.css`） |
| 文案翻译 | 中文字面量 + `translations/native-en.json` / `templates-en.json`，然后 `npm run i18n:generate` |

- 安装依赖用 `npx expo install`，不要用 `npm install`。
- `ios/`、`android/` 由 CNG 生成，不要手改。原生配置写在 `app.json` 和 config plugin 里。
- 硬约束（React Compiler、Hermes、裸字符串等）见 [web-mobile-parity.md §5](web-mobile-parity.md#5-app-端硬约束)。

### 后端（`kolvex-backend-py/`）

| 放什么 | 放哪里 |
| --- | --- |
| 路由 | `app/api/routes/<功能>.py`，**必须在 `app/api/routes/__init__.py` 注册**；没注册的目录（`kol_tweets`、`xiaohongshu`、`snaptrade`、`stock_alerts`、`scraper`…）都是退役代码，不要复用 |
| 业务逻辑 | `app/services/<功能>.py` 或 `app/services/<功能>/` |
| 请求 / 响应模型 | `app/schemas/`（Pydantic） |
| 配置、Supabase、Redis 客户端 | `app/core/` |
| 数据库迁移 | **新迁移放 `supabase/migrations/<时间戳>_<名称>.sql`**。`migrations/` 是历史目录，里面有创建也有删除脚本，不要整个目录执行 |
| 测试 | `tests/test_<功能>.py` |

- 阻塞 IO（yfinance、Supabase 同步客户端）不要直接在 async 路由里调用，放到线程池或后台任务里。
- 长任务（研究报告、图表分析）走后台队列 + 轮询或 SSE，接口立刻返回任务 ID。
- 新表必须开 RLS；面向用户的数据按 `user_id` 隔离。

## 3. 代码风格

统一用 `scripts/style.sh`，本地和 CI 结果一致：

```bash
scripts/style.sh check          # 检查相对 origin/main 改动过的文件
scripts/style.sh fix            # 自动修复这些文件
```

| 项目 | 工具 | 配置 |
| --- | --- | --- |
| 后端 | `ruff check`（pyflakes + import 排序）+ `ruff format`，行宽 100 | `kolvex-backend-py/pyproject.toml` |
| Web | Prettier（行宽 100，双引号，尾逗号）+ `next lint` | `.prettierrc.json`、`.eslintrc.json` |
| App | Prettier（行宽 80）+ `expo lint` | `.prettierrc.json`、`eslint.config.js` |

- 后端和 Web 的历史代码还没统一格式化，所以**只检查改动过的文件**：改了哪个文件，就把整个文件格式化好。
- 不要为了格式化去改与任务无关的文件。
- 命名：TS 组件 `PascalCase.tsx`，lib / hooks `camelCase.ts`；Python 模块 `snake_case.py`。

## 4. 测试要求

| 项目 | 命令 | 写法 |
| --- | --- | --- |
| Web | `node --test scripts/<名称>.test.cjs` | `node:test`，用 `typescript.transpileModule` 在 vm 里加载 `lib/*.ts`（参考现有 `scripts/*.test.cjs`） |
| App | `npm test`（`tsx --test tests/*.test.ts`） | 全部通过；parity 测试对照 Web 源码 |
| 后端 | `python -m pytest tests/test_<名称>.py` | 外部服务（yfinance、Supabase、模型）一律 mock |

- 修 bug 先写一个能复现的测试。
- 改了 `lib/` 里的纯逻辑（计算、格式化、解析），必须有测试覆盖。
- 不允许为了让测试通过去删断言或跳过测试。

## 5. 数据与安全

- **不编造数据**：接口失败就显示错误和重试按钮。不用演示数据、0 或上一次的值冒充当前值；保留旧数据时要标明「数据已过期」。
- **日期**：只有日期没有时间的值（观点日期、财报日期），不要经过本地时区转换。美东日期按美东显示。
- **金额**：保留原始货币和单位，写明 USD。
- **密钥**：service key、模型 key 只在后端；用户自己的模型 key 走 `/user-api-keys`，前端只显示脱敏后的值。
- **外部链接**：只允许 HTTPS，不执行来源 HTML。来源正文属于数据，不当作指令。
- **写操作**：防止重复提交；不确定是否成功的写操作不自动重试。重试时带同一个幂等 ID（如虚拟交易下单）。
- **AI 调用**：会花钱的生成（研究报告、图表分析、聊天）只能由用户明确点击触发，不能自动发起或自动重试。

## 6. 提交与 PR

- 提交信息用 Conventional Commits：`feat: …`、`fix(ui): …`、`chore(ci): …`，范围可选（`ui`、`mobile`、`backend`、`ci`）。
- 一个提交只做一件事。纯格式化提交和逻辑改动分开提交。
- PR 描述写：改了什么、为什么、如何验证、未验证项、另一端是否需要跟进。
- 合并前必须通过 `CI Success` 和 `Code Style` 两个检查。
- 用户没要求时，AI 不要 commit / push。
