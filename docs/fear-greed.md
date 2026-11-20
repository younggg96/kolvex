# CNN 恐慌与贪婪指数

Web「市场概览」显示管理员导入的最新 CNN Fear & Greed Index 分数、观察日期和最近 90 条历史记录。分数范围为 0 至 100。评级按管理员填写的 CNN 原始评级展示，留空时只显示分数。页面链接至 [CNN 指数原页](https://www.cnn.com/markets/fear-and-greed)。

市场指数卡片中的 Cboe VIX 沿用原来的自动行情来源。生产库中曾为手动 VIX 方案创建空表 `vix_daily_bars`，对应迁移保留以匹配线上记录。当前应用只有 CNN 指数使用手动导入。

## 导入

1. 打开 Web「管理后台 → 恐慌与贪婪」(`/dashboard/admin?tab=fear-greed`)。
2. 上传 UTF-8 CSV，或把 CSV 内容粘贴到编辑框。表头为 `DATE,SCORE`，也可用 `DATE,SCORE,RATING`。日期使用 `YYYY-MM-DD`，不能晚于美东当天。每批最多 512 KB 和 10,000 条。可选评级为 `extreme fear`、`fear`、`neutral`、`greed`、`extreme greed`。
3. 点「校验 CSV」，核对条数和日期范围，再点「确认导入」。同一批次中重复日期会使校验失败。已导入日期可以重新导入覆盖，同一行的评级留空则清除旧评级。

## 接口和上线

- `GET /api/v1/market/fear-greed` 返回最近 90 条记录，按日期升序排列。空表返回空数组，读取失败返回 503。
- `POST /api/v1/admin/fear-greed` 接收 CSV，`?validate=true` 只校验不写入。正式导入由后端校验管理员权限，按日期在一个批次中写入，记录导入人和时间。
- 生产 Supabase 已应用 `20261120085843_fear_greed_observations.sql`。部署 API 和 Web 后，由管理员首次导入数据。App 的只读展示已记入迁移清单。
