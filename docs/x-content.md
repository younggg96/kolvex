# X 博主内容

入口：博主观点 → X（`/dashboard/x-opinions`）。支持博主资料、原文时间线、股票标签筛选、分页与来源链接。所有保存和导入操作都由现有管理员权限保护，读取使用公开内容接口。

## 安装

1. 在目标 Supabase 数据库执行 `kolvex-backend-py/migrations/20261030022953_x_creator_content.sql`。迁移新增 `x_creators`、`x_posts` 和事务导入函数，不改动旧 Twitter 表。
2. 后端配置 `SUPABASE_URL` 和 `SUPABASE_SERVICE_KEY`，前端配置 `NEXT_PUBLIC_BACKEND_API_URL`，按仓库说明启动或部署前后端。
3. 管理员登录后打开「管理员 → X 内容」（`/dashboard/admin?tab=x`）。保存博主用户名、名称和简介；保存相同用户名会更新其资料。X 阅读页不再展示管理表单。
4. 选择 JSON 文件，查看校验预览，再点击「导入推文」。导入会自动添加文件内缺失的博主资料，已有资料保持不变。之后可按用户名保存显示名称和简介。

迁移已应用至 Kolvex 的 Supabase 项目；自动采集首轮已写入数据。线上展示需要同时发布前端页面与后端 API，数据库迁移与应用部署是独立步骤。

## 导入格式

支持推文对象数组，或包含 `posts` 数组的导出对象。每批 1 至 500 条，最多 2 MB。必填字段：

| 字段 | 说明 |
| --- | --- |
| `id` | 十进制字符串；不接受 JSON 数字，避免精度损失 |
| `author_username` | X 用户名，可带 @；统一以小写存储与筛选 |
| `published_at` | 包含时区的 ISO 8601 时间，存储为 UTC |
| `text` | 原始正文，最多 50000 字符 |

可选字段：`url`（必须与博主及推文 ID 一致）、`cashtags`（股票代码数组，不提供时从正文 `$TICKER` 标签提取）、`metrics`（`replies`、`reposts`、`likes`、`bookmarks`、`views` 的非负整数或 null）、`quoted_texts`（引用文本数组）、`media_links`（X 图片或视频页面链接数组）、`truncated`、`pinned`。

`side-projects/x-posts/data/MentoviaX-2026-10-26.json` 的现有导出兼容此格式；原始数据仍由该目录的 gitignore 排除，未打包进前端。批内重复 ID 报错；已存在于数据库的 ID 跳过，不更新原文、互动数或发布时间。整个批次在一个数据库事务中写入，失败会整体回滚。重试不会生成重复推文。

用户名更新只影响显示资料，不迁移 X 改名后的历史身份。当前按推文发布日期倒序排列；置顶标记只保留为来源字段，不改变排序。

## API

前端同源代理 `/api/x-content/*` 对应后端 `/api/v1/x-content/*`。

| 方法 | 路径 | 权限与用途 |
| --- | --- | --- |
| GET | `/creators` | 公开读取已保存博主 |
| GET | `/posts?author=mentoviax&ticker=TSLA&limit=20&offset=0` | 公开筛选和分页；limit 上限 100 |
| POST | `/creators` | 管理员保存 username、display_name、bio |
| POST | `/validate` | 管理员校验完整批次，返回数量、博主、股票和截断条数 |
| POST | `/upload` | 管理员原子导入，返回 total、inserted、skipped |

表启用 RLS，并显式授予匿名/登录角色 SELECT。浏览器角色没有表写入和导入 RPC 执行权限；服务端通过现有 `verify_admin` 后才执行写入。服务端密钥不进入前端。

## Web 博主浏览

桌面和手机网页共用大头像横滑栏。选中博主会按作者筛选原帖，并在头像栏下显示该作者的 AI 分析。展开分析可以查看生成时间、观点依据、风险和原帖。「全部博主」恢复全部原帖。

## 逐帖 AI 摘要与股票相关性

应用 `supabase/migrations/20261119221645_x_post_ai_analysis.sql` 后，新导入的完整推文会在原子导入时进入分析队列。每轮本机 `sync.py finish` 先确认入库并更新符合条件的采集检查点，再使用后端 `DEEPSEEK_API_KEY` 调用 DeepSeek V4.1 Flash（`deepseek-flash`，关闭思考模式）分批处理。下一轮继续处理仍待分析的帖子，即使本轮没有新增；迁移前的历史帖不自动回填。

`GET /posts` 的 `ai_analysis` 可为历史帖的 `null`、待分析状态，或包含中英文摘要、相关性、模型和分析时间的完成状态。Web 和 App 在原帖下显示摘要，对 `low` 标注「股票相关性低」，对 `uncertain` 标注「股票相关性不明确」。政治新闻、个人内容或顺带提及股票可被标为低相关，具体公司、交易、股市或有明确股市影响的事件可被标为相关。只有外链或媒体线索时可标为不明确。分析读取原文和有限的引用文字，不访问外链，不改变原帖、股票标签或现有筛选。

模型或分析保存失败时，已入库的原帖仍可阅读，待分析记录留在队列里。完成的分析不会在后续轮次重复生成。浏览器采集与内容阅读本身不触发分析调用。

## 阅读翻译

中文网页优先显示后台已准备的正文和引文译文，缺少预译文时只为进入视口附近的帖子请求即时翻译。排队等待不计入单次请求的超时；加载失败时仍显示原文，可手动重试。译文仅用于阅读，数据库保留原始正文。股票标签和可识别的 HTTPS 链接在翻译时保留。网页和 App 共用 [内容翻译接口](content-translation.md)。

## 当前边界

默认采集入口为 Codex 自动化 `x-kolvex`，每 3 小时由 AI 通过 cua_repl 操作已登录的日常 Chrome。每轮调用 `sync.py prepare`、浏览器采集和 `sync.py finish`，通过校验的完整公开正文自动写入生产数据库。用户已要求每次使用 AI。独立 Playwright LaunchAgent 保持暂停；shell 脚本保留为可选手动方案。说明见 [本地工作流](../side-projects/x-posts/README.md#默认-ai-定时同步)。

名单合并 `sources.json` 和数据库 `x_creators`。通过校验的公开帖子自动导入生产数据库，数据库确认后才更新检查点。采集失败仍处理已完成导出；登录失效、正文缺失和未达到旧边界都保留旧检查点。工作流详见 [采集规程](../side-projects/x-posts/COLLECTOR.md)。

运行依赖本机、Codex、浏览器扩展、已登录的 Chrome 和网络。关机、休眠、登录限制或页面变化可能中断采集。互动数是采集时快照，缺失值保持 null。浏览器采集使用 AI；数据库导入沿用确定性校验，原始正文保持不变。覆盖范围由导出决定，无法视为完整历史。

## 验证

- `cd kolvex-backend-py && venv/bin/python -m unittest tests.test_x_content tests.test_youtube_creator_admin -q`
- 前端新增文件通过 Next ESLint；新增 TypeScript 文件无类型错误。
- 隔离 PostgreSQL 15 验证迁移、25 条真实快照导入、重复导入、错误批次回滚、公开读取与禁止匿名写入/RPC。
- 本地临时预览验证桌面和 390px 手机宽度、TSLA 筛选、空结果、第二页五条推文、错误提示与重试。预览使用真实测试数据库和临时读取适配器；不等同于已登录管理员端到端验证。
- 发布前已补齐 `MarketEventCalendar.tsx` 缺失的滚动引用、状态、处理函数及图标；完整生产构建通过。全项目 UI 审计另有设置页、Reddit select 所有权与全局滚动条的既有问题，新增 X 文件无审计报告项。

## 自动采集验证记录

2026-10-29（洛杉矶）：已启用本机每小时采集。首轮浏览器回溯到上次已知的非置顶检查点，捕获 124 条推文，其中 21 条通过详情页补全，导入新增 123 条。加上此前导入的 25 条，数据库当前合计 148 条、1 位博主。SQL 复查两表 RLS 均启用，匿名角色不能写表或调用导入 RPC；新 X 对象没有出现在安全 Advisor 的问题列表中。

新增 10 项同步测试覆盖提交失败、重复提交、限量回溯、置顶停止条件、旧检查点和博主名单合并；4 项 DOM 提取器测试覆盖作者归属、引用归属、精确计数和截断检测。
