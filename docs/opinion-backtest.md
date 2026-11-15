# 观点事后表现与回测

两部分共用同一套计算方法（`app/services/opinion_backtest.py`）：

1. **界面上的「发布后股价」**（产品功能，第一期）：观点卡片下面一行，写视频发布后股价的实际变化。
2. **回测脚本**（内部研究，不出现在界面里）：汇总博主说看多 / 看空之后有没有跑赢 SPY。

## 界面：发布后股价（第一期）

- 位置：Web `/dashboard/youtube-opinions` 里「某博主 × 某股票」页面底部的「其他博主观点」卡片（`OtherCreatorOpinions` → `OpinionCard` → `OpinionOutcome.tsx`）。归属 `youtubeOpinions` 功能开关，没有新导航入口。
- 内容：`发布后股价 · 5 个交易日 +3.2% 同期 SPY +1.0% · 20 个交易日 未满`，旁边的 ⓘ 说明算法。
- **只陈述事实，不判对错**：不显示「说对 / 说错」、胜率、准确率、博主排名。接口也不返回按方向调整后的数值。
- 状态：持有期没满显示「未满」；发布后还没有完整交易日、拿不到行情（港股、日韩股等）、缺发布时间，各有一句说明；行情接口失败显示「暂时无法加载」。任何情况下都不用 0 代替。
- 接口：`GET /api/v1/youtube-opinions/stocks/{ticker}/outcomes`（`app/services/opinion_outcomes.py`）。独立于观点接口，行情慢或失败不影响观点本身的加载；行情失败返回 503。行情在后端内存缓存 30 分钟，失败不缓存。当天未收盘（美东 16:30 前）的 K 线不参与计算。
- 测试：后端 `tests/test_opinion_outcomes.py`，Web `scripts/opinion-outcome.test.cjs`。
- 还没做：博主页的「最新观点」和视频卡片（多只股票，需要批量行情）；个股图表上的标注；博主层面的汇总（需要更长的数据，见下方「读结果时注意」）；App 端。

## 回测脚本

不是产品功能。用来回答：博主说看多 / 看空之后，这只股票有没有跑赢 SPY。

### 运行

```bash
cd kolvex-backend-py && python scripts/backtest_kol_opinions.py --since 2026-01-01
```

- 只读：用 anon key 读 `youtube_stock_opinions`（公开 SELECT 策略），不写数据库，不调用模型。
- 行情：yfinance 复权日线，按天缓存在 `data/backtests/prices/`。
- 输出到 `data/backtests/`（已加入 `.gitignore`）：`report.md`、`events.csv`（每条观点一行）、`channels.csv`。
- 参数：`--horizons 1,5,20,60`、`--detail-horizon 20`、`--dedupe-days 7`、`--min-n 10`。

## 方法（METHOD_VERSION 1，界面和脚本共用）

代码：`app/services/opinion_backtest.py`，测试：`tests/test_opinion_backtest.py`。

- **事件时间**用 `video_published_at`（换算成美东时间）。不用 `opinion_date`，它默认是上传当天，可能晚于视频。没有发布时间的观点跳过。
- **入场**：美东 09:30 前发布，按当天开盘价；否则按下一个交易日开盘价。
- **出场**：持有第 N 个交易日的收盘价（N=1 即入场当天开盘到收盘）。
- **超额收益** = 个股收益 − 同期 SPY 收益。SPY 缺数据时超额收益为空，不退回用原始收益。
- **方向**：bullish 取正，bearish 取负，得到 `signed_excess`（> 0 表示说对了）。neutral / mixed 只计数。
- **去重**：同一博主对同一股票同一方向，7 天内只保留第一条。
- 当天还没收盘的 K 线不参与计算。价格还没覆盖到的持有期记为 pending，不当作 0。拉不到价格的股票记为 `no_price_data` 并在报告里列出。
- 统计：胜率（Wilson 95% 区间）、均值、中位数、t 值；按情绪、置信度、强度、博主自述期限、博主分组。博主表按中位入场日切成前后两段，方便看前段表现好的博主后段是否还好。

## 读回测结果时注意

- 不含手续费和滑点。
- 拉不到价格的股票（退市、非美股）被排除，结果会偏乐观。
- 同一时段的观点高度相关（大家同一周说同一批股票），t 值会偏高。
- 数据只覆盖很短的时间段时，结果反映的是那段行情，不是博主的长期水平。
- 从很多博主里挑表现最好的那个，会高估其能力。
