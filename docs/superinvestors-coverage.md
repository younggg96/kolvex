# 超级投资者名单（管理员维护）

超级投资者页追踪的 13F 机构名单存在 Supabase 表 `institution_managers` 里，管理员在后台增删改，不再改代码。Web 和 App 都读同一个接口 `/api/v1/market/free-research/institutions`。

## 组成

| 部分 | 位置 | 做什么 |
| --- | --- | --- |
| 表 | `kolvex-backend-py/supabase/migrations/20261117090000_institution_managers.sql` | 一行一家机构：`id`（网址用，不可改）、`cik`（唯一）、英文名、中文名、代表人物和职位（中英）、分组、`enabled`、排序。只有 service role 能读写。种子数据：原来的 33 家（启用），外加 24 家候选（停用） |
| 名单缓存 | `app/services/sec/managers.py`（`manager_registry`） | 启动时读一次，之后每 `INSTITUTION_MANAGERS_REFRESH_SECONDS`（默认 300）秒读一次，管理员保存后当前实例立即重读。读不到表时继续用上一次读到的名单；从没读到过就用内置的 33 家 |
| 管理接口 | `app/api/routes/admin/institutions.py`（`/admin/institutions`） | `GET` 全部（含停用）；`GET /lookup?cik=` 查 SEC EDGAR；`POST` 添加；`PATCH /{id}` 修改或启停。没有删除，停用即可 |
| 管理后台 | `/dashboard/admin?tab=institutions`（「超级投资者」） | 输入 CIK →「查询 SEC」→ 看到 SEC 上的名称和最近一份 13F-HR → 填 ID 和中英文资料 →「加入名单」。列表里可编辑、用开关启停 |
| 前台 | `components/superinvestors/*`、App `Superinvestors.tsx` | 名单接口的 `profile` 字段（中文名、人物、职位）优先；为空时用打包的 `INVESTOR_PROFILES` / `investorProfiles.json`。Logo 仍只有打包的 6 家，其余显示首字母 |

## 规则

- 添加时后端会再查一次 SEC：CIK 必须有 13F-HR 申报，否则返回 `no_13f_filings`；`id`、`cik` 不能重复。
- 新加或重新启用的机构会排队一次 13F 同步（`institution_store.sync_later`），持仓几分钟后出现。停用后机构从公开名单消失，详情页返回 404；已存的 13F 数据保留，重新启用即可恢复。
- 多实例部署时，其他实例最多晚一个刷新周期看到修改。
- 候选机构的 CIK 于 2026-11-16 在 SEC EDGAR 核对过（最新 13F-HR 为 2026-09-30 季度）；中文名和人物资料由管理员启用前再确认。
- 管理后台目前只有中文（与其他管理页一致）。

## 上线步骤

1. 执行迁移 `20261117090000_institution_managers.sql`（未执行时管理页提示 `tables_missing`，公开名单继续用内置 33 家）。
2. 部署后端和 Web。App 无需发版也能看到新机构（名称来自接口）；中文副标题需要 App 包含本次改动。
