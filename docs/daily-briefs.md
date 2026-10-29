# 早晚报 JSON 导入

管理员页 → 早晚报导入，接受单个 `kolvex-brief/1.0` envelope，上传或粘贴上限 2 MB。校验后可预览、保存；改动输入立即撤销校验状态。保存前后均由后端校验，不依赖浏览器权限判断。导入内容仅管理员可见，不自动发布到读者页面。

`brief.id` 必须是 `{type}-{date}`；美西时间允许夏令时 -07:00 和冬令时 -08:00。章节按 order 排序，允许跳号。`market_recap`、`news_to_action`、`outlook`、`premarket` 和 `trading_plan` 共用组件；未知章节保留数据并显示标题、narrative/paragraphs。图片失败显示 caption，来源保留原始 URL。schema 不接受持仓/账户字段。

`POST /api/v1/admin/briefs/validate` 校验并返回标准化 payload，不保存。
`POST /api/v1/admin/briefs` 保存不可变记录；同 ID 同内容重试成功，不同内容返回 409，不覆盖。
`GET /api/v1/admin/briefs?page=1` 每页 10 份；`GET /api/v1/admin/briefs/{id}` 读取原内容。所有路由使用 verify_admin；前端 `/api/admin/briefs` 仅转发当前登录凭证。

数据库迁移：`kolvex-backend-py/supabase/migrations/20261018075322_daily_briefs.sql`。新表启用 RLS，浏览器角色无权限，后端 service_role 仅需 SELECT / INSERT。

界面沿用 DESIGN.md 与运行时 tokens，不增加主题。Button / Input / Textarea / Tabs 由既有共享组件拥有；影响分析使用原生 details；错误和成功沿用管理员导入的内联 alert/status。

验证：`venv/bin/python -m unittest discover -s tests -p test_daily_briefs.py`，前端 `npx tsc --noEmit`、`npm run lint` 和 `npm run build`。用户提供的完整样例保存在 `docs/examples/evening-2026-10-17.json`，回归测试直接读取该文件。指数支持数值或含正确千分位/百分号的字符串；涨跌幅按百分点解析（`-4.48%` → `-4.48`）。顶层 `disclaimer` 显示在文章底部。

## 本次验证记录

首轮 7 项后端测试通过，包含 401/403、校验不写库、错误与大小限制、同内容幂等及不同内容 409。TypeScript、lint 与生产构建通过；lint 仅有原有 VideoPlayer 图片提示。浏览器使用已移除的本地模拟检查页，覆盖格式错误、预览、模拟保存反馈、图片占位、默认/展开影响分析和 390px 暗色布局（document 宽度与 scrollWidth 均为 390）。未使用真实管理员会话验证完整保存链路；后续已用用户提供的完整 JSON 校验并保存到数据库，且读取确认与标准化 payload 相等。

Supabase 新表迁移已应用；查询确认 RLS 开启、anon 不可读、authenticated 不可写、service_role 可写。安全顾问对该表仅报告 [RLS 无策略信息](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)，这是管理员后端专用表的预期默认拒绝设计。项目其他表/函数有既存告警，本次未改变。

全站 premium strict 审计的 3 项既存问题：设置页原生 select 所有权未声明、一个按钮无操作、全局滚动条样式审计命中；新增文件无命中。审计输出位于 /tmp/kolvex-brief-ui-audit.json。

样例兼容修复后共 9 项测试通过，新增完整样例及格式化指数校验。`evening-2026-10-17` 已通过数据库连接保存（并非浏览器导入），共 3 个章节、5 条新闻；本次原文导入未另行核验新闻事实，未发布到读者页面。前后端代码仍待部署。

## Reader tab

`GET /api/v1/briefs?page=1&type=morning` returns ten editorial summaries per page;
`GET /api/v1/briefs/{id}` returns the validated article. Both require a verified
user session, without requiring an administrator role. There are no reader write
routes. Direct browser database access remains denied by the existing RLS/grants;
no database permission migration is needed. Importer audit fields are not selected
by reader APIs. Admin and reader queries share `list_saved_briefs` and
`read_saved_brief`.

The independent primary navigation entry uses `/dashboard/briefs` and
`/dashboard/briefs/{id}`. Query parameters preserve type and page on return.
Saved imports offer a link to the reader; the library links administrators to
`/dashboard/admin?tab=briefs`. This supersedes the original admin-preview-only
scope.

Reader tests: `venv/bin/python -m unittest discover -s tests -p test_brief_reader.py`.

Reader verification: 14 backend tests and 3 Node navigation/date tests passed;
TypeScript, lint/build and DESIGN.md lint passed (existing orphaned-token warnings).
The strict premium audit still lists the same three pre-existing settings/global
scrollbar findings; none references the new reader files. Read-only checks using
the real Supabase client confirmed the summary projection, empty morning filter
and the complete saved evening article. Production browser checks confirmed the
primary navigation, filtered empty state, article sections/disclaimer, preserved
return filter, missing-issue recovery, and 390px mobile layout (scrollWidth equals
viewport width). A browser-found title reset on filter navigation was corrected.

## Date calendar

`GET /api/v1/briefs?date=2026-10-17&type=evening` combines date and edition
filters. `GET /api/v1/briefs/calendar?month=2026-10` returns only dates/types
in that month, grouped for calendar markers; authentication is unchanged.
The existing ID constraint permits at most two records per date, so a bounded
62-row query covers any month. Dates are the imported Pacific issue dates.

The reader opens on today in America/Los_Angeles and requests only that date,
even when no issue has been published. It never falls back to a historical issue.
The localized calendar, Today and previous/next day select one date at a time;
Morning/Evening tabs switch the full article within that selected date. Article links and return actions preserve date/type/page.
It does not display the intro sentence or an import control; Admin still owns
importing. Empty dates remain selectable and show an explicit empty state.

## Direct daily reader

The main reader fetches `GET /api/briefs?id={type}-{date}` and displays full
`BriefContent`, with only Morning/Evening tabs. Default date is Pacific today;
default edition is Morning before 13:00 Pacific and Evening afterwards. Explicit
URL selections take precedence. Missing editions show an empty state and never
fall back to historical content. The date button opens the shared Popover and
Calendar; selecting a date or Today closes it. The list API and durable article
URLs remain available for compatibility and Admin. Import remains Admin-only.

## Three daily editions (supersedes the two-edition descriptions above)

| Display | brief.type / ID prefix | Regular-session reference |
| --- | --- | --- |
| 盘前 1 小时 | morning | 08:30 ET / 05:30 PT |
| 盘中 | intraday | During regular trading |
| 盘后 1 小时 | evening | 17:00 ET / 14:00 PT |

Each date has three independent immutable IDs, e.g. `intraday-2026-10-28`.
Existing morning/evening IDs and JSON remain valid under kolvex-brief/1.0.
Import one envelope per edition. Admin's shared Select filters saved issues and,
when explicitly selected, rejects a JSON edition mismatch without rewriting it.
The auto option recognizes the edition from JSON. Preview and save revalidate;
identical retries succeed, conflicting content for the same issue returns 409.
Both reader and admin lists accept `type=intraday`. The calendar permits 93 rows
per month and shows three edition markers. Reader defaults to pre-market before
06:30 PT, intraday from 06:30 until 14:00 PT, and post-market thereafter; explicit
URL choices take precedence. Holidays/early closes are not scheduled by this
manual importer, and generation timestamps are not enforced as release times.
This change does not add automatic report generation or timed publishing.

Migration `20261029061350_daily_briefs_intraday.sql` extends only the type check;
33 existing records, access grants and RLS are preserved.

Validation: 18 backend tests, 7 Node reader/date tests, TypeScript, lint and
production build passed. Remote constraint was read back successfully. Premium
static audit reports only the same three existing settings/scrollbar findings.
Browser verification could not run: local Next server listen failed with EPERM.
Application code still needs deployment; the database migration is applied.

## Chinese / English reading

No JSON changes are required. The shared `BriefContent` renders explicit 中文 /
English buttons that use the saved site language and translate editorial copy via
the existing `/api/translate` service. Preview and saved reader share this behavior;
translations are display-only, and saves still submit the original envelope.
Identity, symbols, financial values, time/URL fields and source attribution are
preserved. Source language is detected from the title/headline/subtitle. The full
original stays readable while translating or on failure, with retry. Exact-copy
translations are cached for the mounted source; four workers, cancellation and a
90-second timeout bound a translation pass. Corrected sources cannot reuse stale
translated copy. Run `node --test scripts/brief-translation.test.cjs` for coverage
of copy selection, data preservation, concurrency, caching, retry and cancellation.
