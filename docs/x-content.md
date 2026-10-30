# X 博主内容

入口：博主观点 → X（`/dashboard/x-opinions`）。支持博主资料、原文时间线、股票标签筛选、分页与来源链接。所有保存和导入操作都由现有管理员权限保护，读取使用公开内容接口。

## 安装

1. 在目标 Supabase 数据库执行 `kolvex-backend-py/migrations/20261030022953_x_creator_content.sql`。迁移新增 `x_creators`、`x_posts` 和事务导入函数，不改动旧 Twitter 表。
2. 后端配置 `SUPABASE_URL` 和 `SUPABASE_SERVICE_KEY`，前端配置 `NEXT_PUBLIC_BACKEND_API_URL`，按仓库说明启动或部署前后端。
3. 管理员登录后打开 X 页面，展开「管理博主与导入推文」。保存博主用户名、名称和简介；保存相同用户名会更新其资料。
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

## 当前边界

没有接入 X API。现已启用 Codex 本地每小时浏览器采集，复用已登录 Chrome，并合并 `side-projects/x-posts/sources.json` 与数据库博主名单；工作流详见 [采集规程](../side-projects/x-posts/COLLECTOR.md)。新增博主会在后续轮次纳入。它依赖本机、Codex、Chrome 及扩展可用，不能保证关机或休眠期间采集。互动数是采集时快照；缺失的数值保持 null。导入不会推断情绪、总结投资观点或分析图片。媒体展示为来源链接；内容覆盖范围仍由导出文件决定，不能视为完整历史。

## 验证

- `cd kolvex-backend-py && venv/bin/python -m unittest tests.test_x_content tests.test_youtube_creator_admin -q`
- 前端新增文件通过 Next ESLint；新增 TypeScript 文件无类型错误。
- 隔离 PostgreSQL 15 验证迁移、25 条真实快照导入、重复导入、错误批次回滚、公开读取与禁止匿名写入/RPC。
- 本地临时预览验证桌面和 390px 手机宽度、TSLA 筛选、空结果、第二页五条推文、错误提示与重试。预览使用真实测试数据库和临时读取适配器；不等同于已登录管理员端到端验证。
- 发布前已补齐 `MarketEventCalendar.tsx` 缺失的滚动引用、状态、处理函数及图标；完整生产构建通过。全项目 UI 审计另有设置页、Reddit select 所有权与全局滚动条的既有问题，新增 X 文件无审计报告项。

## 自动采集验证记录

2026-10-29（洛杉矶）：已启用本机每小时采集。首轮浏览器回溯到上次已知的非置顶检查点，捕获 124 条推文，其中 21 条通过详情页补全，导入新增 123 条。加上此前导入的 25 条，数据库当前合计 148 条、1 位博主。SQL 复查两表 RLS 均启用，匿名角色不能写表或调用导入 RPC；新 X 对象没有出现在安全 Advisor 的问题列表中。

新增 10 项同步测试覆盖提交失败、重复提交、限量回溯、置顶停止条件、旧检查点和博主名单合并；4 项 DOM 提取器测试覆盖作者归属、引用归属、精确计数和截断检测。
