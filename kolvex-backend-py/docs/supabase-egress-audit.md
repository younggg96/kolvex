# Supabase Egress 排查与修复

核查日期：2026-11-02（America/Los_Angeles）。本次完成本地代码修改、测试和真实数据库只读验证；没有部署、重启现有服务、删除数据或修改业务表结构。

## 已核实的调用源和运行方式

全仓库搜索 `claim_stock_chart_job`，Python 生产调用只有 `app/services/stock_chart_jobs.py::StockChartJobs.claim`。其他命中是迁移、SQL 测试和 Python 测试。调用链为：

```text
FastAPI main.py lifespan（CHART_WORKER_ENABLED 默认 true）
  -> asyncio.create_task(run_worker())，每个 API 进程启动一次
  -> asyncio.to_thread(StockChartJobs.claim)
  -> Supabase PostgREST RPC claim_stock_chart_job
```

另一个合法入口是 `python -m app.services.stock_chart_jobs`，供独立 Worker 部署使用。若同时运行独立 Worker 和默认启用 Worker 的 API，两者都会消费队列。

| 运行入口 | 仓库配置/实际证据 |
| --- | --- |
| Railway `railway.toml` / `Procfile` | Uvicorn 启动，没有明确指定进程数；`WEB_CONCURRENCY`、平台副本与服务数量可能改变实际消费者数 |
| 开发 Docker Compose | Uvicorn `--reload`；每次应用生命周期启动会创建 Worker |
| 原生产 `Dockerfile.prod` | 明确 `--workers 4`，每个容器会启动 4 个 Worker；本次改为 1 |
| 本机 PID 53640，端口 8080 | cwd 为本项目，没有显式禁用 Worker；`/tmp/kolvex-backend.log` 持续记录约 3.1 秒一次的成功 claim RPC |
| 本机 PID 68977，端口 8082 | cwd 为本项目，进程环境明确 `CHART_WORKER_ENABLED=false`，不是 claim 来源 |
| 本机端口 8000 的 Uvicorn | cwd 为其他项目，排除 |

Railway 插件返回需要重新认证；本机 Railway CLI 未关联项目。因此没有确认线上副本数、其他服务是否重复启动或线上 `WEB_CONCURRENCY`，也没有修改线上配置。55,701 次/日、约 2,300 次/小时来自用户已确认数据；频率与两个约 3 秒轮询的消费者接近，**不等于证明线上有两个副本**。本机 8080 是已证实的持续调用来源之一。

## 实施内容

- 空队列固定等待 60 秒；处理完一个任务立即 claim 下一个任务，直至空队列。
- 使用进程级非阻塞锁，拒绝同一进程重复启动。claim 和任务处理均串行 await。
- 取消时等待已提交到线程的 claim 结束，避免取消协程后线程仍在请求、替代 Worker 又开始轮询；若此时 claim 到任务，沿用 `ai_job_interrupted` 失败状态。
- 保留既有 RPC 错误退避 6 / 12 / 24 / 30 秒、480 秒生成超时、失败代码、完成事务与显式用户重试语义。未增加会重复计费的自动 AI 任务重跑。queued/running 的数据库过期逻辑与 `SKIP LOCKED` 保持原样。
- 启停日志记录 PID、主机和空闲间隔，便于核对实际消费者数量。生产 Docker 默认一个 API 进程；若需增加 API 进程/副本，应在 API 设置 `CHART_WORKER_ENABLED=false`，另行运行所需数量的独立 Worker。
- 为明确公开的股票新闻、K 线和 X 读取添加服务端缓存、同键并发请求合并和容量限制。
- X 查询移除 `*` 和嵌套 `*`，改为已核实存在的显式字段。帖子原有 limit/offset 保留；创作者列表增加 limit/offset，默认 1000、最大 1000，与原默认 Data API 上限兼容。
- AI 历史查询使用显式字段；列表及当前记录合并为一次作者资料查询。研究分析列表将原“查询 ID 来计数 + 查询当前页”合并为一次带 exact count 的分页查询，减少一次请求和返回 ID 数据。

## API 审计与缓存边界

| 数据 | 审计结果与处理 |
| --- | --- |
| 股票新闻 `/market/news/{symbol}` | 来自 Yahoo，原先重复请求会再次访问新闻源；新增 60 秒缓存。原始源数量受限，不是无界新闻全表查询 |
| RSS `/news/feed` | 原有 60 秒缓存、并发锁、最多 100 篇、1 MB 下载限制与短期旧数据回退，保留并补充缓存命中监控 |
| X `/x-content/posts` | 原有服务端分页，默认 20、最大 100；保留，显式投影，新增 60 秒公共缓存 |
| X creators/summaries | creators 增加分页；summaries 是固定本地快照并校验有限 source IDs；新增 60 秒公共缓存 |
| K 线 `/market/history/{symbol}` | Yahoo 按 period/interval/start/end 取数，无 Supabase 全表扫描；新增 60 秒缓存，完整查询参数参与键。保留完整图表范围，未擅自截断 K 线 |
| 日内 K 线 `/market/intraday/{symbol}` | 新增 30 秒缓存 |
| 图表任务状态 | 私人数据，不进入公共缓存。前端在加载任务时约每 3 秒串行轮询，终态停止；每次 latest 仍有过期 RPC 和两个按 operation 的 limit(1) 查询 |
| AI 图表历史 | 已有分页，默认 10、最大 50；current、is_owner 和激活指针与用户有关，不进入公共缓存；保留现有完整结果与原始 bars 的兼容行为 |
| AI 研究分析 | 保留分页、完成状态和公开状态检查；不缓存可撤销公开的报告，避免取消公开后仍从缓存返回。详情的单行 `select("*")` 仍保留，以兼容完整报告结构 |
| 投资组合、Auth、API keys、私人绘图 | 全部绕过新公共缓存 |

公共缓存每个进程最多 128 条、16 MiB 正文；单响应超过 2 MiB 不缓存。只存成功响应，拒绝带 Set-Cookie、Vary 或 private/no-store 的响应。CORS 位于缓存外层，每次请求独立生成 Origin 响应头。成功修改 X 内容会清空本进程公共缓存；其他进程最多等待 TTL。缓存不依赖 Redis，因此本地 Redis 不可用时仍有保护，但不会跨副本共享命中。

## 监控

新增 `egress_metrics` 结构化 JSON 日志，每 60 秒输出一个窗口，并在正常退出时刷新：

- `source=supabase`：本后端共享 service client 的 PostgREST 请求数、响应数、响应正文字节数及 HTTP 错误数；按表名或 RPC 名聚合。
- `source=api`：API 请求数、实际输出正文字节数、HTTP 错误数。命中公共缓存的请求也纳入统计。
- `source=cache`：公共缓存 hits、misses、hit ratio；RSS 原有缓存也纳入统计。
- 日志包含 PID，可跨进程汇总。指标不记录查询条件、用户 ID、token、密钥或正文。

按 `source=supabase` 的 `response_bytes` 排序定位后续流量源；用 `requests` 区分“请求多但返回小”和“大响应”。不要把 API 输出字节再次累加为 Supabase Egress。字节数是解码后的应用正文，不含 TLS/HTTP 头、压缩差异，不能直接代替平台账单。Auth、Storage、Realtime、浏览器直接访问 Supabase 及其他脚本不在这一 service-client 统计中，仍需对照 Supabase 分服务用量和日志。指标目前是窗口日志，不是永久指标数据库；需要日志平台收集并汇总。

## 前后请求量

以下区分估算与实测，不将本地改动写成已经部署后的生产数据：

| 场景 | 修改前 | 修改后 | 依据 |
| --- | --- | --- | --- |
| 单个始终空闲 Worker | 理论 1,200 次/小时，28,800 次/日 | 60 次/小时，1,440 次/日 | 3 秒 → 60 秒，约下降 95%，不含启动/网络耗时 |
| 按已知实际调用量、消费者数量不变 | 55,701 次/日，约 2,300 次/小时 | 估计约 2,785 次/日、115 次/小时 | 按 1/20 估算；需要所有调用源更新才成立 |
| 原生产 Docker 单容器空闲 | 4 Worker，理论 4,800 次/小时 | 1 Worker，60 次/小时 | 同时应用 Docker 进程数改动时，理论下降 98.75% |
| 有连续任务 | 处理完任务立即 claim | 同样立即 claim | 没有增加任务间等待；从空闲转为有任务，首次发现最多约 60 秒 |
| 相同公共查询，20 个并发请求 | 没有此服务端缓存时会进入处理器 20 次 | 测试中进入处理器 1 次、19 次命中，命中率 95% | 新增并发测试，其他层缓存另计 |
| 实际应用入口读取同一推文页两次 | 无此缓存时读取数据库两次 | 实测仅一次 Supabase 请求 | 真数据库只读验证：MISS/HIT，各返回 1,103 字节；上游一次 1,086 字节 |
| 研究分析列表 | 计数查询 + 当前页查询 | 一次带 count 的当前页查询 | 作者补充查询仍另计 |
| 图表历史作者装饰 | 有 current 时两次资料查询 | 合并为一次 | 不改变 owner/current 逻辑 |

空队列正常响应是 `null`，正文约 4 字节。55,701 次仅相当于约 223 KB 的该正文数据，另有协议开销；**不能用此 RPC 调用数解释全部 6.93 GB**。只读样本中一个 AI 历史版本返回约 103 KB，主要是 payload（约 102.7 KB），说明大分析结果也是需持续监控的方向；单个样本并不是整库分布或主要费用来源的证明。

## 验证

- 相关测试 **73 项全部通过**，包含原有任务成功/失败/超时/取消/所有权，以及新增空闲间隔、连续消费、错误退避、重复启动、取消中线程 claim 的互斥、缓存并发合并、分页键、TTL/容量、私人路由隔离、错误/Cookie/private 响应、CORS、写后失效与监控字节数测试。
- 最新全量测试运行 **330 项，14 个错误**。错误集中于 AI 测试中的已退役 `deepseek-chat` 模型，以及本地 MCP SDK 接口不兼容；在修改前 HEAD 的隔离快照中复核相同测试，确认此次修改没有引入这些错误。完整结果见本机 `/tmp/kolvex-egress-tests.log`，对应基线见 `/tmp/kolvex-egress-baseline-failures.log`。
- 真实 Supabase 只读验证：活动任务 0；X 创作者/帖子新字段投影及 stock_analysis_versions 投影均成功。没有调用 claim 以避免领取或改变任务。
- 实际 `main.app` ASGI 请求验证：重复推文页请求为 MISS、HIT，200 响应，Supabase 请求计数为 1。未运行 lifespan，避免测试启动消费者或陈旧任务清理。
- `git diff --check` 通过。没有增加或执行迁移。

## 修改文件

全部路径相对于 `kolvex-backend-py/`：

| 文件 | 用途 |
| --- | --- |
| `app/services/stock_chart_jobs.py` | 60 秒空闲轮询、串行消费、进程防重、取消中 claim 处理、独立进程监控 |
| `Dockerfile.prod` | 默认进程数 4 → 1 |
| `app/core/public_read_cache.py` | 新增公共数据缓存 |
| `app/core/egress_metrics.py` | 新增流量与命中率监控 |
| `app/core/supabase.py` | 给现有 service client 安装 HTTPX 监控 hooks，兼容当前锁定 SDK |
| `main.py` | 缓存/监控中间件与指标日志生命周期 |
| `app/api/routes/x_content.py` | 创作者分页参数 |
| `app/services/x_content.py` | 显式投影与创作者分页 |
| `app/services/news_feed.py` | RSS 缓存命中率 |
| `app/services/stock_analysis_history.py` | 显式投影与合并作者资料查询 |
| `app/services/trading_analysis_service.py` | 合并 count 与分页请求 |
| `tests/test_egress_controls.py` | 新增 10 项回归测试 |
| `README.md` | 运行方式、监控说明、修正原迁移文件名引用 |
| `docs/supabase-egress-audit.md` | 本报告 |

## 尚存风险和上线验收

1. **现有运行进程仍是旧代码**，改动只有在更新/重启对应服务后才生效。Railway 需恢复只读访问后核对所有服务、环境、区域副本、启动命令与进程数；当前没有证据可宣称生产流量已经下降。
2. 进程锁不跨进程/机器；数据库 `SKIP LOCKED` 防同任务重复领取，但不会减少多个 Worker 的空队列探测。Docker 外的平台副本必须单独核对。
3. 公共缓存是每进程的；不同参数或不同副本仍会分别访问数据源。写后跨副本最多 60 秒可见延迟。Worker 内直接调用 Yahoo 不经过 HTTP 缓存；任务不会因此停止取新市场数据。
4. AI 结果正文仍可能很大，图表历史列表仍返回现有 payload/current/bars 以兼容已有 Web/移动客户端。进一步变更成元数据列表和按需详情需同步核对全部消费者；本次没有擅自削减返回内容。
5. 活动图表页每 3 秒状态查询仍可能放大查询数；完成/失败后停止。可根据监控决定是否再合并状态查询，当前保持过期检测与状态语义。
6. 6.93 GB 是已发生的累计用量，代码优化降低后续用量，不会倒扣现有用量。官方说明：[Manage Egress usage](https://supabase.com/docs/guides/platform/manage-your-usage/egress)。
7. 更新全部调用源后，对比至少一小时的 claim 计数、每个 PID 的启动日志、`source=supabase` 字节排行和缓存 hit ratio；观察任务从 queued 到 completed/failed 的正常转移、首次领取延迟及队列长度。业务/计费平台确认前，不承诺具体 GB 节省。
