# 超级投资者名单（管理员维护）

超级投资者页追踪的 13F 机构名单存在 Supabase 表 `institution_managers` 里，管理员在后台增删改，不再改代码。Web 和 App 都读同一个接口 `/api/v1/market/free-research/institutions`。

## 组成

| 部分 | 位置 | 做什么 |
| --- | --- | --- |
| 表 | `kolvex-backend-py/supabase/migrations/20261117045338_institution_managers.sql` | 一行一家机构：`id`（网址用，不可改）、`cik`（唯一）、英文名、中文名、代表人物和职位（中英）、分组、`enabled`、排序。只有 service role 能读写。种子数据：原来的 33 家（启用），外加 24 家候选（停用） |
| 名单缓存 | `app/services/sec/managers.py`（`manager_registry`） | 启动时读一次，之后每 `INSTITUTION_MANAGERS_REFRESH_SECONDS`（默认 300）秒读一次，管理员保存后当前实例立即重读。读不到表时继续用上一次读到的名单；从没读到过就用内置的 33 家 |
| 管理接口 | `app/api/routes/admin/institutions.py`（`/admin/institutions`） | `GET` 全部（含停用）；`GET /lookup?cik=` 查 SEC EDGAR；`POST` 添加；`PATCH /{id}` 修改或启停。没有删除，停用即可 |
| 管理后台 | `/dashboard/admin?tab=institutions`（「超级投资者」） | 输入 CIK →「查询 SEC」→ 看到 SEC 上的名称和最近一份 13F-HR → 填 ID 和中英文资料 →「加入名单」。列表里可编辑、用开关启停 |
| 前台 | `components/superinvestors/*`、App `Superinvestors.tsx` | 名单接口的 `profile` 字段（中文名、人物、职位）优先；为空时用打包的 `INVESTOR_PROFILES` / `investorProfiles.json`。Logo 打包了 10 家机构（另加软银、方舟、索罗斯、Situational Awareness，取自 FMP 股票 logo 与官网图标）和佩洛西的公有领域官方肖像（Wikimedia Commons，2019）；段永平 / H&H 没有可用的公开图片，与其余机构一样显示首字母 |

## 规则

- 添加时后端会再查一次 SEC：CIK 必须有 13F-HR 申报，否则返回 `no_13f_filings`；`id`、`cik` 不能重复。
- 新加或重新启用的机构会排队一次 13F 同步（`institution_store.sync_later`），持仓几分钟后出现。停用后机构从公开名单消失，详情页返回 404；已存的 13F 数据保留，重新启用即可恢复。
- 多实例部署时，其他实例最多晚一个刷新周期看到修改。
- 候选机构的 CIK 于 2026-11-16 在 SEC EDGAR 核对过（最新 13F-HR 为 2026-09-30 季度）；中文名和人物资料由管理员启用前再确认。
- 管理后台目前只有中文（与其他管理页一致）。

## 明星投资者

Web 和 App 的目录顶部可切换巴菲特、桥水、阿克曼、凯茜·伍德、软银、Leopold Aschenbrenner、段永平、索罗斯和佩洛西。机构按 SEC CIK 匹配当前启用的名单。软银集团（CIK 1065521）和 Situational Awareness LP（CIK 2045724）由迁移 `20261117075014_featured_superinvestor_managers.sql` 加入，已有的管理配置优先。

- 桌面和手机网页共用大头像横滑栏，姓名下的短线标记当前选中人物。巴菲特、达利欧、阿克曼、凯茜·伍德、孙正义、索罗斯和佩洛西使用有明确复用许可的肖像，下方「肖像来源」列出作者及许可。段永平和 Leopold 暂用姓名缩写。选中人物后，卡片在姓名下显示对应的 13F 申报机构。
- 明星专区与下方「13F 机构目录」各有独立标题和区域。点头像只切换明星专区；机构目录继续使用机构标志和实际申报数据，点「排序」在面板中选择最新申报、规模或调仓最多。

- **机构持仓**读取最近一份 13F，排除期权和已清仓记录，按 CUSIP 合并股份类持仓。显示前五大，每只证券的占比以该份申报里所有非期权股份类持仓的报告市值为分母。含 ETF。每行带公司 logo（取不到时显示代码缩写）；机构专区不再提供个股曲线，右侧只显示 13F 模拟组合。占比口径收在标题旁的 ⓘ 里。
- **个股收益**读取 `/market/free-research/{symbol}/stock-returns`。仅用于佩洛西专区。按 Yahoo Finance 复权日收盘价计算，以区间开始前最后一个收盘价为 0%，可选 1月、3月、6月、今年（YTD，默认）。曲线标注实际覆盖日期，口径在 ⓘ 里。
- **机构模拟收益**读取 `/market/free-research/institutions/{manager}/performance`，对比同期间的 SPY。模型按事后可见的季度末股票快照回看并串联季度收益，忽略披露延迟、期权和费用。历史申报有缺口时从最近一段连续数据开始画。需要 `20261117075023_institution_13f_performance.sql` 和后台历史回填。未计算和覆盖不足分别显示状态。季度点之外，后端（`METHOD_VERSION = 3`）还把最近约 400 天每个 SPY 交易日按当季持仓重新估值，输出 `daily`；前端据此提供 1月、3月、6月、今年（YTD，默认）区间，两条线都以区间开始前最后一个交易日为 0%。曲线起点晚于区间开始时显示数据不足，不截短冒充。方法版本升级后旧缓存视为待计算，后台约一小时内重算。模型口径放在标题旁的 ⓘ 里。同一张图也显示在每家机构的详情页（Web `SuperinvestorDetail`、App `superinvestor/[manager]`），位于概览和持仓之间。
- **佩洛西**使用已有的众议院交易披露，显示最近五条匹配记录的证券、交易日期、方向、申报金额区间和可用原文。选择有代码的披露可查看标的个股曲线，每行带公司 logo，金额区间说明放在 ⓘ 里。该来源不足以计算持仓占比、期权收益或账户收益。

## 上线步骤

1. 执行迁移 `20261117045338_institution_managers.sql`（未执行时管理页提示 `tables_missing`，公开名单继续用内置 33 家）。已于 2026-11-16 应用到 Supabase 项目 `kolvex-backend`：33 家启用、24 家候选。
2. 执行 `20261117075014_featured_superinvestor_managers.sql`（软银、Situational Awareness）和 `20261117075023_institution_13f_performance.sql`（季度快照表、模拟收益表）。两者已于 2026-11-16 应用到 `kolvex-backend`。再部署后端与 Web；后端启动约 10 分钟后开始回填历史 13F 并计算曲线。App 可从后端名单看到新机构，明星专区需更新 App。
