# 股票估值数据核验

截止日期：2026-11-04；生成时间：2026-11-04T08:30:38.556182+00:00。

这是阶段A的真实来源核验，不是估值结果。候选完整率仅表示存在完整的十二个月 EPS 输入，不代表拆股口径已核验。

| 股票 | 当前 EPS 输入 | 历史候选完整率 | 缺少直接 Q4 EPS 的年度数 | 行情交易日 | PE 发布条件 |
| --- | --- | --- | --- | --- | --- |
| NVDA | missing_quarter_eps | 24.2% | 5 | 1254 | 未通过 |
| AAPL | complete | 24.5% | 5 | 1254 | 未通过 |
| MSFT | missing_quarter_eps | 25.3% | 5 | 1254 | 未通过 |

## 结论与下一步

历史候选完整率按审计窗口内实际取得的有效收盘交易日计算；没有取得的交易日不会被统计为成功。未单独核对整个交易所日历，因此该比例也不是行情完整率。

1. 为缺失的直接披露 Q4 EPS 补充可追溯来源，例如公司正式年度业绩公告；不以全年 EPS 减前三季累计 EPS 代替。
2. 为采用的财报 EPS 核验拆股展示基准，记录依据；不能仅根据申报日或期间结束日推定股本基准。
3. 通过以上核验后，再生成 PE 参考曲线和当前区间。现有阅读财报接口保持原行为。

## 来源与复现

完整结果、各交易时点的输入事件、申报链接和来源校验和见同目录 `report.json`。原始响应保存在命令指定的缓存目录，文件按内容哈希命名；离线重放会检查校验和。

运行命令和口径见仓库 `docs/stock-valuation/README.md`。

- [SEC Company Facts 官方说明](https://www.sec.gov/search-filings/edgar-application-programming-interfaces)
- [yfinance 价格历史参数](https://ranaroussi.github.io/yfinance/reference/yfinance.price_history.html)
- [Yahoo 复权收盘价说明](https://help.yahoo.com/kb/SLN28256.html)

未核验行情公开展示权限；本报告仅供内部开发验证。
