# 股票观察实施与验证

日期：2026-10-29。实现于现有 Next.js 应用，未部署。

## 已完成

- 固定八股 Popular 区域改为“股票观察”。常看美股提供 25 家跨行业公司、行业选择及名单内价格排序。
- 博主关注默认按当前纽约日对应的近七天观点条数排列；最新观点允许历史内容，以原文发布时间或观点日期排列，不用导入时间冒充发布时间。
- 手机、平板、桌面均展示来源明确的观点线索；股票与观点为独立链接。后者带 `insight=creators#stock-insights`，打开原个股页的博主情报面板。
- 默认十行，显式加载更多；URL 保留范围、行业、排序、行数，浏览器记住范围/行业/排序，返回链接带列表状态并恢复主滚动位置。
- 排除现有详情路由不支持的股票代码。报价缺失显示不可用；错误、加载和确认空窗口分别处理。报价重试只在本次请求强制刷新。

## 验证结果

| 检查 | 结果 |
|---|---|
| stock-discovery、market-index-routes、market-quotes、loading-states、decision-regressions、opinion-dates | 30 / 30 通过，见 tests.log |
| TypeScript noEmit | 通过 |
| 改动文件 Next lint | 无警告、无错误 |
| 生产构建 | 通过，见 build.log |
| DESIGN.md lint | 0 errors；7 个既有 token 引用警告 |
| git diff --check | 通过 |
| 窄屏 390px、平板 768px、桌面 1440px | 观察列表无横向溢出 |
| 中英文、浅色/深色 | 已截图并检查 |
| 行业与排序弹层 | 打开、选择、键盘上下键与 Enter 可用，选择后焦点返回 stock-sort |
| 范围、行业与加载更多 | 金融筛选四股正确；10→20 行及 URL 参数更新正确 |
| 观点导航与返回 | 原股票、观点入口、from 参数、20 行恢复及非零滚动恢复已验证 |
| 异常 | 注入空数据和 502，确认空状态与失败分别显示；失败不显示虚假的 0/0 数量，重试成功恢复 |
| 浏览器控制台 | 最后正常桌面页面无 error 日志 |

## 浏览器验证范围

预览地址：http://127.0.0.1:3007/dashboard 。临时工具位于 `/tmp/kolvex-stock-observation-preview`，不进入应用路由，不修改认证。该工具渲染实际的 StockObservationList、CreatorIntelligence、共享控件和 LanguageProvider，替代 Next 路由/图片适配。

博主数据来自公开只读 Railway API。抽样返回 236 个股票聚合，152 个近七天活跃；过滤现有详情路由不支持的代码后，观察到近期列表 148 只、最新观点列表 231 只。数量随数据更新变化。

预览报价通过临时代理调用真实后端的只读行情请求，并按现有股票 API 的字段映射显示；走势图读取真实历史 API。未伪造公司观点、价格或走势。注入失败/空数据仅用于临时预览的异常验证，已清除。

当前本地 Next 服务的博主代理因后端配置不可用返回 500，批量报价返回 503；完整 dashboard 需要登录。因此本次没有宣称完成登录外壳及完整个股工作区的浏览器端到端验证。正式个股路由的 insight/from 传参由路由测试验证，临时预览的详情只展示观点组件。

生产构建在隔离的源码副本 `/tmp/kolvex-stock-observation-production-check` 运行，避免与既有 3000 端口开发服务争用 `.next`。保留既有 Supabase Edge Runtime 与 VideoPlayer 图片告警，没有为消除这些告警改动无关代码。

## 设计核对

原图为讨论起点，本次按用户接受的结构调整目标评估，而非一比一复制旧页面。现有字体、语义颜色、扁平行分隔、Button/Select 与滚动所有权得到保留。窄屏让走势图让位于股票身份、报价和证据；源作者姓名保留原文，不翻译成人工编造名称。

| 既有规范 | 实施 | 结论 |
|---|---|---|
| 复用全局主题与共享控件 | 无新调色板、字体或全局 CSS | 一致 |
| 信息可追溯 | 独立观点链接与原文日期 | 一致 |
| 信息不足时不编造结果 | 价格、日期和窗口缺失分别处理 | 一致 |

本次新增的观察列表布局与状态行为已经记录于 DESIGN.md 和 docs/decision-workspace.md。

截图：mobile-core-dark.png、mobile-creators-dark.png、tablet-core-en.png、desktop-core-en.png、mobile-sector-open.png、mobile-empty.png、mobile-error.png。

Scoped component QA final result: passed. Authenticated full-flow verification: not performed.
