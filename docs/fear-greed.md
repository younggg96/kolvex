# CNN 恐慌与贪婪指数

Web「市场概览」右侧栏顶部（自选股上方）显示最新 CNN Fear & Greed Index 分数、观察日期和最近一个月的走势（以最新观察日期往前推一个自然月）。分数下方是一条横向分档刻度，带分数标记，按 CNN 的五档区间（0–25、25–45、45–55、55–75、75–100）分色。分数范围为 0 至 100。评级按 CNN 原始评级展示，留空时只显示分数。页面链接至 [CNN 指数原页](https://www.cnn.com/markets/fear-and-greed)。

市场指数卡片中的 Cboe VIX 沿用原来的自动行情来源。生产库中曾为手动 VIX 方案创建空表 `vix_daily_bars`，对应迁移保留以匹配线上记录。CNN 指数的数据由本机 Playwright 脚本自动同步，管理员 CSV 导入保留作补数和纠错。

## 自动同步（本机 Playwright）

CNN 拒绝普通 HTTP 客户端，所以由本机浏览器打开 [CNN 指数页](https://www.cnn.com/markets/fear-and-greed)，截取页面自己请求的图表数据（`production.dataviz.cnn.io/index/fearandgreed/graphdata`），原样发给后端。

| 部分 | 位置 | 作用 |
| --- | --- | --- |
| 本机脚本 | `side-projects/fear-greed/collect.py`（`./start.sh`） | 用本机 Google Chrome（无头模式）打开 CNN 页面，截取图表 JSON，带 `X-Worker-Token` POST 给后端。没截到数据或后端拒绝时以非零状态退出，不写任何数据 |
| 定时 | `side-projects/fear-greed/install_worker.sh [分钟]` | 安装 macOS LaunchAgent `app.kolvex.fear-greed`，登录后立即跑一次，之后每 60 分钟（可改，最少 15）跑一次；日志在 `logs/collect.log`。Mac 休眠时不跑，唤醒后补跑 |
| 后端 | `POST /api/v1/fear-greed/worker/cnn` | 校验 `FEAR_GREED_WORKER_TOKEN`（为空则返回 503，整个功能关闭），解析后按日期 upsert，`updated_by` 为空表示自动同步 |
| 管理后台 | `/dashboard/admin?tab=fear-greed` 顶部 | 显示是否开启、最新一天的日期 / 分数 / 来源（自动同步或管理员导入）/ 更新时间；开启时超过 24 小时没更新会提示检查 Mac |

解析规则（`parse_cnn_graph`）：
- 历史点 `x` 为 UTC 零点的毫秒时间戳，取该 UTC 日期为交易日；当前读数 `fear_and_greed.timestamp` 带真实时间，换算为美东日期。同一天以当前读数为准。盘中每次同步会覆盖当天的值，收盘后的最后一次即为当日收盘值。
- 每次写入 CNN 返回的全部历史（约一年、250 个交易日），首轮同步即完成回填。会覆盖同日期的管理员导入值。
- 评级统一成小写，不在五档内的评级存为空，分数照常保存。晚于美东今天的点丢弃。
- 结构不对、任一点日期或分数无效（非数字、超出 0–100）时整份拒绝（422），不写入任何一行，避免 CNN 改格式后写进半解析的数据。

上线步骤：
1. 在 Railway API 服务设置 `FEAR_GREED_WORKER_TOKEN`（随机长字符串），部署后端和 Web。
2. 在 Mac 上：`cd side-projects/fear-greed && ./setup.sh`，复制 `.env.worker.example` 为 `.env.worker` 并填写 `KOLVEX_API_URL`、`KOLVEX_WORKER_TOKEN`。
3. `./start.sh --dry-run` 试抓（不写库），再 `./start.sh` 同步一次，确认后台显示「自动同步」，最后 `./install_worker.sh`。
4. 无头模式被 CNN 拦截时，在 `.env.worker` 设 `FEAR_GREED_HEADLESS=false`；没装 Chrome 时运行 `./setup.sh --chromium` 并设 `FEAR_GREED_BROWSER_CHANNEL=`。

## 手动导入（补数 / 纠错）

1. 打开 Web「管理后台 → 恐慌与贪婪」(`/dashboard/admin?tab=fear-greed`)。
2. 上传 UTF-8 CSV，或把 CSV 内容粘贴到编辑框。表头为 `DATE,SCORE`，也可用 `DATE,SCORE,RATING`。日期使用 `YYYY-MM-DD`，不能晚于美东当天。每批最多 512 KB 和 10,000 条。可选评级为 `extreme fear`、`fear`、`neutral`、`greed`、`extreme greed`。
3. 点「校验 CSV」，核对条数和日期范围，再点「确认导入」。同一批次中重复日期会使校验失败。已导入日期可以重新导入覆盖，同一行的评级留空则清除旧评级。

## 接口和上线

- `GET /api/v1/market/fear-greed` 返回最近 90 条记录，按日期升序排列。空表返回空数组，读取失败返回 503。
- `GET /api/v1/admin/fear-greed/status`（管理员）返回 `worker_configured` 和最新一天的 `date`、`score`、`updated_at`、`source`（`worker` / `admin`）。
- `POST /api/v1/admin/fear-greed` 接收 CSV，`?validate=true` 只校验不写入。正式导入由后端校验管理员权限，按日期在一个批次中写入，记录导入人和时间。
- 生产 Supabase 已应用 `20261120085843_fear_greed_observations.sql`。不需要新迁移。App 的只读展示已记入迁移清单。
