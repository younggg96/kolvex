# 博主观点回测（内部研究脚本）

不是产品功能，不出现在任何界面里。用来回答：博主说看多 / 看空之后，这只股票有没有跑赢 SPY。

## 运行

```bash
cd kolvex-backend-py && python scripts/backtest_kol_opinions.py --since 2026-01-01
```

- 只读：用 anon key 读 `youtube_stock_opinions`（公开 SELECT 策略），不写数据库，不调用模型。
- 行情：yfinance 复权日线，按天缓存在 `data/backtests/prices/`。
- 输出到 `data/backtests/`（已加入 `.gitignore`）：`report.md`、`events.csv`（每条观点一行）、`channels.csv`。
- 参数：`--horizons 1,5,20,60`、`--detail-horizon 20`、`--dedupe-days 7`、`--min-n 10`。

## 方法（METHOD_VERSION 1）

代码：`app/services/opinion_backtest.py`，测试：`tests/test_opinion_backtest.py`。

- **事件时间**用 `video_published_at`（换算成美东时间）。不用 `opinion_date`，它默认是上传当天，可能晚于视频。没有发布时间的观点跳过。
- **入场**：美东 09:30 前发布，按当天开盘价；否则按下一个交易日开盘价。
- **出场**：持有第 N 个交易日的收盘价（N=1 即入场当天开盘到收盘）。
- **超额收益** = 个股收益 − 同期 SPY 收益。SPY 缺数据时超额收益为空，不退回用原始收益。
- **方向**：bullish 取正，bearish 取负，得到 `signed_excess`（> 0 表示说对了）。neutral / mixed 只计数。
- **去重**：同一博主对同一股票同一方向，7 天内只保留第一条。
- 价格还没覆盖到的持有期记为 pending，不当作 0。拉不到价格的股票记为 `no_price_data` 并在报告里列出。
- 统计：胜率（Wilson 95% 区间）、均值、中位数、t 值；按情绪、置信度、强度、博主自述期限、博主分组。博主表按中位入场日切成前后两段，方便看前段表现好的博主后段是否还好。

## 读结果时注意

- 不含手续费和滑点。
- 拉不到价格的股票（退市、非美股）被排除，结果会偏乐观。
- 同一时段的观点高度相关（大家同一周说同一批股票），t 值会偏高。
- 数据只覆盖很短的时间段时，结果反映的是那段行情，不是博主的长期水平。
- 从很多博主里挑表现最好的那个，会高估其能力。
