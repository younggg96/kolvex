# 行情重大事件日历

入口：行情 `/dashboard?tab=calendar`；管理员后台 `/dashboard/admin?tab=events`。
日历按 `America/New_York` 的周一至周日，仅返回上周、本周、下周。
只展示 `status=published` 且（`importance=high` 或 `is_hot=true`）的事件。
历史、远期、草稿和取消事件保留在数据库，可在管理员列表分页编辑。

## JSON 导入

[完整示例](examples/market-events.json) · [JSON Schema](market-events.schema.json)
后台也提供模板下载。模板是明确标注的草稿，日期和股票代码仅为格式演示。
先校验预览，再保存。同一 ID 是完整替换，重复导入不会新增副本；未列出的事件保留。
下架时将 status 改为 draft 或 cancelled 并保存。每批最多 200 条、1 MB；批量 upsert 为单次数据库事务。
同时编辑同一事件时以最后一次保存为准，保存前先刷新列表并加载最新内容。

| 字段 | 约束／含义 |
| --- | --- |
| schema_version | 固定 `kolvex-market-events/1.0` |
| timezone | 固定 `America/New_York` |
| events | 事件数组，ID 不得重复 |
| id | 稳定 ID，1–100 个英文字母、数字、下划线、短横线，首字符为字母或数字 |
| title / title_en | 中文标题必填，英文标题选填，最长 200 字符 |
| category | earnings / fed / economic / other |
| event_date | 美东日期 YYYY-MM-DD |
| timing | scheduled / before_open / after_close / all_day / tbd |
| starts_at | 仅 scheduled 必填，ISO 8601 且带 UTC 偏移；转换美东后必须与 event_date 相同。其他 timing 必须为 null |
| importance | high / medium / low，默认 high |
| is_hot | 布尔值，默认 false |
| status | draft / published / cancelled，默认 draft |
| summary / summary_en | 选填说明，最长 4000 字符 |
| tickers | 最多 30 个股票代码，入库时转大写并去重 |
| source_name / source_url | 来源名称与 HTTP(S) 链接，链接不可含用户名密码 |

没有精确时间的财报使用 before_open / after_close / tbd，不捏造发布时间。
后台校验器额外校验跨字段日期／时间关系，JSON Schema 不能单独替代后台校验。

## API 与权限

- GET `/api/v1/market/events`：要求登录，返回完整三周范围。
- GET `/api/v1/admin/market-events?page=1`：管理员读取全部状态，每页 200 条。
- POST `/api/v1/admin/market-events/validate`：只校验，不入库。
- POST `/api/v1/admin/market-events`：管理员批量保存。
- Next.js 同源代理：`/api/market/events`、`/api/admin/market-events`（`?validate=1` 校验）。

后台沿用 verify_admin，实时查询 user_profiles.is_admin。浏览器不能直接读写表。
表启用 RLS，撤销 anon / authenticated 权限，仅服务端 service_role 可访问。
Next.js 代理后端地址优先 BACKEND_API_URL，再使用 NEXT_PUBLIC_BACKEND_API_URL。

## 数据库与验证

迁移 `kolvex-backend-py/supabase/migrations/20261026212538_market_events.sql`
已于 2026-10-26 应用到配置对应的 kolvex-backend 项目，远程迁移版本一致。
已核验 RLS 和三种角色的表权限；安全顾问的“RLS Enabled No Policy”为服务端专用表的预期 INFO。
其他既有全局安全建议未在本次功能范围内变更。

验证：后端 test_market_events.py，前端 scripts/market-events.test.cjs，TypeScript、ESLint、生产构建。
部署前端和后端新代码后即可使用；数据库已就绪，未导入演示事件。

## 本次验证记录

- 后端 9 项单元／API 测试及前端 4 项日期／时区测试通过。
- 生产构建、TypeScript 和相关文件 ESLint 通过（构建保留 VideoPlayer 的既有 img 提醒）。
- 远程数据库事务断言通过，合成测试数据回滚，真实事件表为空。
- 全项目 premium UI 静态审计报告保存在 artifacts/market-events-ui-audit.json；
  未通过的 3 项为既有 settings 原生 select 归属、settings 按钮静态检测和全局滚动条 opt-in，均不属于本次新增组件。
- 浏览器验证加载、空日历、三周切换、后台列表、无效 JSON 错误、有效草稿预览、切换栏目保留草稿、390px 窄屏和键盘周切换；未保存示例事件。
