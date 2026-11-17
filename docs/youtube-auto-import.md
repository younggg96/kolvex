# YouTube 自动导入

把「网站未追踪的博主新视频 → 字幕 → 股票观点 → 数据库」串成一条自动流程。每天定时运行一次，管理员也可以在后台立即运行。

## 组成

| 部分 | 位置 | 做什么 |
| --- | --- | --- |
| 本地 worker | `side-projects/youtube-notes/auto_import.py`（`./start.sh worker`） | 每分钟向后端领取任务；有任务时读取网站未追踪视频（同 `batch untracked`），本地获取字幕（同 `batch run --transcript-only`，无字幕用 MLX Whisper），逐个把字幕发给后端 |
| 后端 | `kolvex-backend-py/app/services/youtube_auto_import.py`、`app/api/routes/youtube_auto_import.py` | 管理排队、定时、进度；用 DeepSeek 分析字幕，再走与「JSON 导入」相同的校验和写入（`YouTubeStockOpinionService.upload_import`） |
| 管理后台 | `/dashboard/admin` →「YouTube 导入」→「自动导入」 | 显示定时、worker 是否在线、最近 5 次运行与每个视频结果；「立即运行」 |

字幕需要在 Mac 上获取（YouTube 常拦截云服务器 IP，Whisper 依赖 Apple Silicon），所以 worker 跑在本地；DeepSeek Key 只在后端。

## 运行规则

- 同一时间最多一个排队或运行中的任务（数据库唯一索引保证）。手动运行冲突时返回 `run_in_progress`。
- 定时：每天 `YOUTUBE_IMPORT_SCHEDULE_TIME`（默认 `21:00`，`YOUTUBE_IMPORT_TIMEZONE` 默认 `America/Los_Angeles`）之后，worker 第一次领取任务时创建当天的定时任务；每天最多一个。电脑休眠到第二天才唤醒时，前一天的定时任务不补跑（下一次运行仍会处理所有未追踪视频）。
- worker 30 分钟没有心跳，任务标为失败；worker 重启后会继续它正在运行的任务，已导入的视频不重复分析。
- 结果：全部成功 →「完成」；部分视频字幕或分析失败 →「部分失败」；没有任何导入且有失败 →「失败」。没有新视频也算完成。
- 分析结果里的博主和视频身份一律以 worker 提供的元数据为准，不用模型输出；导入时照常按 YouTube 核对发布时间和频道。后端连不上 YouTube（Data API 未开通且网页被限流）时，发布时间改用 worker 提供的值：它来自网站「未追踪视频」接口，本身已经核实过。手动 JSON 导入没有这个退路。
- 模型没有明确个股观点时返回 `opinions: []`，只保存视频总结（和手动导入一致）。

## 配置

后端（Railway 主服务）：

| 变量 | 说明 |
| --- | --- |
| `YOUTUBE_IMPORT_WORKER_TOKEN` | worker 共享密钥，空则整个功能关闭 |
| `DEEPSEEK_API_KEY` | 已有 |
| `YOUTUBE_IMPORT_MODEL` | 默认 `deepseek-v4-pro`（DeepSeek 接口目前只接受 `deepseek-v4-pro` 和 `deepseek-flash`） |
| `YOUTUBE_IMPORT_SCHEDULE_TIME` / `YOUTUBE_IMPORT_TIMEZONE` | 定时时间与时区 |

数据库迁移：`kolvex-backend-py/supabase/migrations/20261116150000_youtube_auto_import.sql`（两张表只允许 service role 访问，未开放 RLS 策略）。

本地 worker：见 `side-projects/youtube-notes/README.md`「自动导入」。

## 接口

- 管理员：`GET /api/v1/admin/youtube-auto-import/status`、`POST /api/v1/admin/youtube-auto-import/run`
- worker（请求头 `X-Worker-Token`）：`POST /api/v1/youtube-auto-import/worker/claim`、`/runs/{id}/heartbeat`、`/runs/{id}/videos`、`/runs/{id}/finish`

## App

App 管理中心未移植这个面板（见 `kolvex-mobile/MIGRATION.md`）。
