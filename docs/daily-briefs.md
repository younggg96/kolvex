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
