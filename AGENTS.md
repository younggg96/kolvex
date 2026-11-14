# Kolvex — AI 开发入口

> 所有 AI 编码助手（Claude Code、Codex、Cursor 等）开始任何任务前先读本文件。
> 本文件只放「每次都必须知道」的内容；细节按下方路由表去读 `docs/` 里对应的文档，不要一次全部读完。

## 1. 项目是什么

Kolvex：面向中文用户的美股研究产品。核心是**博主观点记录**（谁、在哪天、对哪只股票、说了什么、多强），每条观点都能追溯到原视频/原帖；旁边配行情、AI 研究报告、日报和用户持仓。

| 目录 | 技术栈 | 说明 |
| --- | --- | --- |
| `kolvex-frontend-web-nextjs/` | Next.js 14 App Router · React 18 · Tailwind 3 · Radix · Supabase Auth | Web 端（含 PWA），**产品功能的参考实现** |
| `kolvex-mobile/` | Expo SDK 58 · RN 0.88 · React 19 + React Compiler · Expo Router | iOS/Android App，从 Web 移植 |
| `kolvex-backend-py/` | FastAPI · Pydantic · Supabase · Redis · LangGraph | 两端共用的后端，统一前缀 `/api/v1` |
| `docs/` | Markdown | 跨项目规范、功能文档、设计规范 |

## 2. 先读哪份文档（任务路由）

完整索引见 [docs/README.md](docs/README.md)。常见任务：

| 你要做的事 | 必读 |
| --- | --- |
| 任何代码改动 | [docs/engineering/development-standards.md](docs/engineering/development-standards.md) |
| 新增 / 修改一个功能 | [docs/product/feature-catalog.md](docs/product/feature-catalog.md) 里该功能那一行 + 它链接的功能文档 |
| 任何界面改动（Web 或 App） | [docs/design/design-system.md](docs/design/design-system.md)，再读对应端的 `DESIGN.md` 相关章节 |
| 把 Web 功能移植到 App，或反过来 | [docs/engineering/web-mobile-parity.md](docs/engineering/web-mobile-parity.md) + `kolvex-mobile/MIGRATION.md` |
| 改 App（任何 Expo / RN API） | `kolvex-mobile/AGENTS.md`（Expo 版本变化快，必须查对应版本文档） |
| 改后端接口 | `kolvex-backend-py/README.md` + 该功能的文档 |
| 改 CI / 代码风格 | `.github/CICD_SETUP.md` |

## 3. 硬性规则（无论什么任务）

1. **以代码为准，不以文档为准**。文档和代码冲突时，按 [docs/README.md](docs/README.md) 的「事实来源优先级」判断，并在交付时指出冲突。
2. **功能开关只看 `kolvex-frontend-web-nextjs/lib/productFeatures.ts`**。`RETIRED_PRODUCT_ROUTE_PREFIXES` 里的功能（KOL tracker、选股器、通知/预警、社区等）不得重新出现在导航里。
3. **不编造数据**：不造博主、不造观点、不造收益率、不造报价。接口失败就显示失败，不能用演示数据或 0 冒充真实值。
4. **颜色与方向**：品牌色和语义色只从 `kolvex-frontend-web-nextjs/app/globals.css` 的 token 取，不写死 hex。涨跌必须同时有符号或文字，不能只靠颜色。
5. **中文优先，双语**：所有界面文案都要有中英文两份（Web 用 `useCopy`/`useTranslation`，App 规则见移植规范）。不要翻译用户输入和原始来源正文。
6. **不做有副作用的真实操作**：不要用真实账号登录、不要触发付费模型调用（「更新 AI 研究」、发聊天消息、跑研究任务）、不要写生产数据库、不要改 RLS / 管理员权限 / OAuth 配置。
7. **密钥只在后端**：Supabase service key、模型 API key 绝不进入前端或 App 代码。
8. **没让你提交就不要 commit / push**。

## 4. 完成标准（Definition of Done）

改了哪个项目就跑哪个项目的检查，全部通过才算完成，并在汇报里贴出结果：

```bash
# 所有项目：代码风格（只检查改动过的文件）
scripts/style.sh check

# Web
cd kolvex-frontend-web-nextjs && npm run lint && npx tsc --noEmit && node --test scripts/<相关>.test.cjs

# App
cd kolvex-mobile && npx tsc --noEmit && npx expo lint && npm run i18n:check && npm test

# 后端
cd kolvex-backend-py && python -m pytest tests/<相关测试>.py
```

同时要做到：
- 功能行为有变化时，**同一个改动里**更新对应功能文档和 [docs/product/feature-catalog.md](docs/product/feature-catalog.md)。
- 涉及两端的功能，在汇报里写明另一端是否需要跟进；需要跟进就更新 `kolvex-mobile/MIGRATION.md`。
- 汇报里如实写出**哪些没有验证**（比如没在模拟器 / 真机上看过、没走登录后的写操作）。
