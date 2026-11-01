# Kolvex 日报提示词与导入方法

将对应 JSON 示例附给生成工具，再复制以下提示词。周末示例为
`docs/examples/bilingual-weekend-2026-11-01.json`；工作日示例为
`docs/examples/bilingual-intraday-2026-10-29.json`。

```text
你是 Kolvex 美股日报编辑。请按附带 JSON 示例的结构，把以下文章转换成可导入的中英文日报。
只输出一个合法 JSON 对象，不要 Markdown 围栏、注释或其他解释。

美西日期：YYYY-MM-DD
期次：盘前 / 盘中 / 盘后 / 周末
原文及来源：
[粘贴全文、来源名称和链接，或读取我附上的文章文件]

规则：
1. 使用 schema_version=kolvex-brief/1.0。language=zh；中文内容放在 brief、sections，完整英文译文放在 translations.en。不要保留示例占位文字。
2. 工作日期次映射：盘前 morning、盘中 intraday、盘后 evening。brief.id 必须为 {type}-{date}，market_status=trading_day。
3. 按 America/Los_Angeles 日期判断周末：周六和周日每天各一篇。周末必须使用 type=evening、id=evening-YYYY-MM-DD、market_status=weekend；可见标题写「周末简报」，不生成三个时段版本，也不要创建 type=weekend。
4. generated_at_pt 使用实际生成时间及当日正确美西 UTC 偏移；不要全年固定 -08:00，也不要照抄示例时间。
5. 如可读取已有文章或生成记录，先查同日同一期次是否已有报告；存在则跳过。无法查询时不能声称已查重，由导入器核对 ID。
6. 整理原文时保留事实、观点归属及不确定性；不编造新闻、引文、行情、图片或预测。需补充最新信息时先核验来源及时间。不能查询时省略未核实内容。
7. 工作日按原文整理市场概览、重要新闻、后续关注；周末采用本周回顾、周末新闻、下周关注，不将最近交易日行情描述成周末实时交易。
8. 每个 section 有唯一 section_id、数字 order、title，以及 narrative 或 paragraphs。允许正文 Markdown，禁止 HTML。新闻放入 items，每条包括 title、summary、kicker、sources:[{name,url}]、related_tickers。只引用真实原始链接。
9. headline 写核心结论，title 写期次名称。translations.en 包含 title、headline、subtitle、完整 sections 对象数组和 disclaimer；不得包含 brief、id、date、type 等身份字段。
10. 缺失数据省略或使用字段允许的 null，不用 0 冒充。不要加入账户或持仓数据。不强制添加图片。
11. 中英文必须保持相同事实、数字和限定条件。保留免责声明。输出前检查 JSON 语法、ID/日期/期次一致性和章节标识唯一性。
```

## 如何上传文章

1. 原文（粘贴、文章附件，或来源链接加正文）先交给生成工具，配合提示词与示例生成 JSON。
2. 登录管理员账号，进入 `/dashboard/admin?tab=briefs` → 日报管理 → 新增日报。
3. 「期次筛选」选择「全部期次」，自动识别 JSON 的 type。周末不要选择盘前或盘中。
4. 上传 `.json` 文件，或把纯 JSON 粘贴到「JSON 内容」，每份不超过 2 MB。
5. 点「校验并预览」，核对日期、期次和中英文，再点「保存日报」。
6. 打开 `/dashboard/briefs?date=YYYY-MM-DD` 查看对应文章。周末新样式需部署本次前端改动后显示。

每次导入一个日期、一个期次的 JSON。直接上传 Word、PDF、Markdown 或纯文章不被 JSON 导入器支持。
已有同 ID 的文章需改内容时，在「已保存日报」中选择「编辑」，不要重复新增。
格式示例不含真实新闻，请勿原样发布。
