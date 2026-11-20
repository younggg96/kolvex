# 内容分享

入口：Web 各内容卡片上的「分享」按钮 · 公开页 `/share/[id]` · 设置 → 偏好设置 →「我的分享」 · App 待移植 · 功能开关：跟随所在功能（无单独开关）

## 用户能做什么

- **分享 AI 回答**：聊天里每条已保存的 AI 回答下有「分享」；也可以**选中回答里的一段文字**，点浮出的「分享所选内容」只分享这一段。可选择是否附上自己的提问。因为聊天是私有内容，弹窗先展示接收者会看到的内容，并提示「任何拿到链接的人无需登录即可看到」，用户点「创建分享链接」后才生成。
- **分享博主观点**（YouTube 观点卡片）、**X 博主动态**、**人物动态**、**期权异动 AI 研究候选**、**已发布的 AI 研究报告**：点卡片上的分享图标直接生成链接。
- 生成后可以：复制链接；系统分享面板（手机）；X、微博、Telegram、WhatsApp、Facebook、邮件（只预填，发布仍由用户在对方应用里确认）；**复制文案（含原始来源和链接）**，可粘贴到微信 / 小红书；**图片**页签生成 1200×630 分享图，可保存或通过系统分享发送。
- 链接在社交平台和聊天应用里自动显示预览卡片（标题、摘要、分享图）。
- 「停止分享」：弹窗里或「我的分享」列表里随时撤销，链接立即对所有人失效。

## 规则

- **快照由后端从数据库原始记录生成**，前端只提交「分享哪一条」（类型 + ID）。客户端提交的文字一律不进入快照，唯一例外是聊天选段：后端会在去掉 Markdown 格式和空白后核对选段确实是原回答的一部分，对不上返回 `excerpt_not_found`。
- 快照不可变：原内容之后被修改或删除，已分享的链接仍显示分享时的内容（附原日期）；用户撤销后才失效。
- 同一用户重复分享同一内容（同一选段、同一语言、同样是否附提问）复用已有链接。每个用户 24 小时内最多新建 100 个链接。
- 聊天：只能分享自己对话里已保存的 AI 回答；提问会去掉附带的页面上下文。分享内容会去掉 emoji。
- 期权异动：数据授权仅限登录用户，所以分享链接 `visibility = signed_in`。未登录访问只看到合约名称（如 `NVDA $150 Call · 2026-12-19`）和登录按钮，不返回理由、成交额等内容；登录后由 `/api/shares/[id]` 带会话读取完整内容。
- AI 研究：只能分享**已发布且已完成**的报告，快照包含结论和投资计划（最长 3000 字），并链接到公开报告页 `/research/[id]`。
- 博主观点保留博主、美东日期、原视频链接；强度用文字描述，不显示数字分数。AI 生成的内容（聊天、研究、期权候选）在卡片底部标注「AI 生成 · 不构成投资建议」。
- 分享页面不进搜索索引（`robots: noindex`），ISR 缓存 600 秒；撤销时 `revalidateTag` + `revalidatePath` 立即清掉缓存。
- 分享图（`opengraph-image`）按需从 Google Fonts 拉取图上用到的 Noto Sans SC 字形；拉取失败时退回无中文字体渲染。
- 不做：分享整段对话、分享持仓 / 虚拟账户、匿名用户创建链接（未登录点分享会提示登录）。

## 实现

| 层 | 位置 |
| --- | --- |
| Web | `components/share/`（`ShareButton`、`ShareDialog`、`SelectionShare`、`SharedCard`、`SharedPage`）、`components/settings/ShareLinksSettings.tsx`、`lib/contentShare.ts`（类型、链接、文案）、`lib/contentShareApi.ts`、`app/api/shares/`（代理）、`app/share/[id]/`（公开页 + 分享图）；接入点：`chat/ChatBubble.tsx`、`youtube/OpinionCard.tsx`、`x/XContentExplorer.tsx`、`person-updates/PersonUpdateTimeline.tsx`、`options-activity/sections.tsx`、`trading-analysis/report-actions.tsx` |
| App | 待移植（见 `kolvex-mobile/MIGRATION.md`） |
| 后端 | `app/api/routes/content_shares.py`（`POST/GET /shares`、`GET/DELETE /shares/{id}`）、`app/services/content_shares.py`（各类型快照构建、选段核对、限流、撤销） |
| 数据库 | `supabase/migrations/20261120090000_content_shares.sql`：`content_shares` 表，开启 RLS 且不给 anon / authenticated 任何权限，只有后端 service role 读写 |

旧的博主整页分享（`/share/creators/[channelId]`、`CreatorShare`）保持不变。

## 验证

- 已验证：`python -m pytest tests/test_content_shares.py`（8 项：选段核对、他人回答不可分享、编造选段被拒、去重、期权未登录只给预告、研究必须已发布、仅本人可撤销、路由）；`node --test scripts/content-share.test.cjs`；`npx tsc --noEmit`、`npm run lint`。用本地假后端（不连数据库）在浏览器看过 `/share/[id]` 的 AI 回答、选段、博主观点、期权锁定页，390px 和桌面、浅色和深色，以及中文分享图。
- 未验证：迁移尚未在 Supabase 执行；登录后真实创建 / 撤销链接的完整流程、分享弹窗的实际交互、聊天选段浮动按钮、微信等应用里的链接预览都没有实际走过。
