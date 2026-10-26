# 听记 · YouTube 批量中文笔记

独立的本地命令行 side project，**没有前端页面**。从指定博主发现视频，筛选并批量生成中文字幕与中文摘要。默认使用本地 Ollama；没有字幕时使用 Apple Silicon 上的 MLX Whisper。无需云端 AI Key、Kolvex 数据库密钥或 YouTube API Key。

## 你的博主名单

`channels.kolvex.json` 来自 [Kolvex 博主页](https://kolvex.app/dashboard/youtube-opinions?tab=creators) 使用的同一份博主聚合数据，通过公开 dashboard API 读取，当前包含 14 位：小左第一视角、老A聊美股、NaNa说美股、阳光财经、美投侃新闻、视野环球财经、StockTalkwithJay美股、Sam谈美股、明日走势—美股BTC量化交易、老李玩钱、投资TALK君、股市咖啡屋 Stock Cafe、XTrader猫姐美股、美投讲美股。

默认每位匹配最新 **5 个**常规视频，扫描最近 20 条上传，不限制关键词和日期。它是可修改的起始配置；不会自动运行定时任务或向 Kolvex 写入分析结果。

## 安装

```bash
cd side-projects/youtube-notes
brew install ffmpeg ollama
./setup.sh --whisper
```

已有字幕只需 `./setup.sh`；`--whisper` 为缺失字幕的视频安装转写依赖。需要 Python 3.11+、Apple Silicon 才能使用 MLX。若当前 Python 没有可用 MLX wheel，可安装 Python 3.12 并指定：`PYTHON_BIN=/opt/homebrew/bin/python3.12 ./setup.sh --whisper`。

启动 Ollama（已运行则跳过），下载语言模型：

```bash
ollama serve
# 另开终端：
ollama pull qwen2.5:7b
./start.sh --check
```

`setup.sh` 使用专属 `.venv`，不修改系统 Python。语言模型与 Whisper 权重不包含在仓库内，首次使用需下载，可能占数 GB 空间。运行 `./setup.sh` 可以更新 yt-dlp。

## 批量使用

### 只处理网站最新未追踪视频（推荐）

使用网站黄色提示对应的覆盖接口，只选择各博主上次已追踪视频之后、尚未导入的上传，不扫描每个频道最近 N 条视频：

```bash
./start.sh batch untracked
./start.sh batch run batches/kolvex-untracked.json --transcript-only
./start.sh combine batches/kolvex-untracked.json --output output/combined_untracked_latest.json
```

第一步只保存清单，不下载音频、不调用 AI。清单按发布时间从新到旧排序，使用公开接口，无需登录或数据库密钥。`run` 开始前会重新核对网站，移除已被导入的视频并纳入最新未追踪视频；仍未追踪的条目保留本地处理状态，已完成字幕不会重复处理。网站接口失败或任一博主状态无法确认时停止，不使用旧清单继续转写。查询范围截断时会提示本批次只包含已确认的未追踪视频。

该命令使用专用清单，不混入以前 `batch discover` 累积的历史视频，也不会覆盖普通批次。字幕和股票观点导入是两个步骤：本地字幕完成但尚未导入网站时，视频仍会显示“未追踪”。如果想生成中文笔记而不是仅获取原文字幕，可省略 `--transcript-only`，这需要启动 Ollama。

### 1. 同步博主名单

```bash
./start.sh sync
```

此命令读取 Kolvex 的公开博主聚合接口，更新 `channels.kolvex.json`，不读取登录凭证、不写线上数据。若接口失败，会保留现有配置。再次同步会覆盖你对该配置的自定义修改；需要长期自定义时先复制为其他文件。

### 2. 发现视频，保存待处理清单

```bash
./start.sh batch discover \
  --config channels.kolvex.json \
  --output batches/kolvex.json
```

这一步只读取视频列表与必要的元数据，不下载音频、不调用语言模型。可以先查看 JSON 中的 `videos`，每项含博主、标题、链接、时长、上传日期（可得时）和处理状态。

指定条件，例如每位最近上传的 50 个视频中，找到最多 3 个标题提到 NVDA 或英伟达的视频：

```bash
./start.sh batch discover \
  --config channels.kolvex.json \
  --keyword NVDA --keyword 英伟达 \
  --exclude-keyword 广告 \
  --since 2026-10-01 --until 2026-10-21 \
  --limit 3 --scan-limit 50 \
  --output batches/nvda-october.json
```

日期首尾包含。关键词匹配**视频标题**，不搜索字幕正文；包含词为 OR，排除词任一命中则排除。没有日期条件时，频道平铺结果中未知的上传日期会保持 `null`；有日期条件时会逐条补查日期，仍未知则记录错误并排除。只扫描最近 `scan_limit` 条，不代表穷尽整个频道历史。

也可以临时指定多个频道：

```bash
./start.sh batch discover \
  --channel @yttalkjun --channel @acestockpicks \
  --limit 5 --output batches/selected.json
```

频道支持 `@账号`、`/channel/UC…`、`/c/…` 和 `/user/…`。当前读取 `/videos`，不单独采集 Shorts 或直播列表；传入频道的 `/shorts`、`/streams` 链接也会规范化到常规视频页。单次最多 100 个频道，每频道最多扫描 500 条。跳过已识别的直播、待播与超过 3 小时的视频；处理前还会检查时长。

### 3. 批量生成中文字幕与摘要

```bash
./start.sh batch run batches/kolvex.json
```

默认按顺序处理，减少 Mac 的显存竞争。单条失败会记录原因并继续下一条；再次执行会跳过已完成且结果仍存在的条目。处理期间清单会持续保存输出位置和当前阶段。失败后重试：

```bash
./start.sh batch run batches/kolvex.json --retry-failed
```

也可以不使用语言模型，仅获取已有原文字幕，缺失时本地转写：

```bash
./start.sh batch run batches/kolvex.json --transcript-only
```

此模式不生成中文翻译和摘要；之后不加此参数运行，仍会执行完整中文笔记流程。

同一清单重复 `discover` 会按视频 ID 去重、保留旧处理状态、累积新匹配。`run` 会处理清单中的全部未完成项，而不只处理最近一次发现的匹配。修改筛选范围后想使用独立批次，请指定新的 `--output` 清单路径。

## 单视频

```bash
./start.sh 'https://www.youtube.com/watch?v=jNQXAC9IVRw'
# 不使用 Ollama：
./start.sh 'https://www.youtube.com/watch?v=jNQXAC9IVRw' --transcript-only
```

也可以直接运行 `.venv/bin/python youtube_transcribe.py URL`、`.venv/bin/python batch.py …`、`.venv/bin/python sync_kolvex.py …`。

## 整合视频数据为 JSON

直接整合已有任务、视频元数据和字幕，格式与 `output/combined_jobs_zh.json` 一致。整合步骤只读取文件，不调用 Ollama，不分析股票观点。

```bash
# 整合这批 15 个视频
./start.sh combine data/kolvex-untracked-2026-10-22.zip \
  --output output/combined_jobs_zh_2026-10-22.json

# 整合现有输出目录的全部 job.json + zh.txt
./start.sh combine output --output output/combined_jobs_zh.json
```

也支持批次目录或 `manifest.json`。输出顶层字段为 `generated_at`、`source_directory`、`task_count`、`with_zh_count`、`items`；每条保留 `task_directory`、`job`、`zh`、`missing_files`。ZIP 中没有单独的 job.json 时，使用清单中的原任务记录并附上已获取的 metadata。未提供 zh.txt 的中文原始字幕可以直接使用；其他语言保留在 original 字段，zh 为 null，缺失文件会明确记录，不做翻译或推断。

后续新视频可以按以下顺序获取数据再整合，全流程无需语言模型：

```bash
./start.sh batch discover --config channels.kolvex.json --output batches/kolvex.json
./start.sh batch run batches/kolvex.json --transcript-only
./start.sh combine batches/kolvex.json --output output/combined_jobs_latest.json
```

字幕获取和原有可选翻译/摘要命令仍可独立使用；此工作流只整合数据。

## 输出

结果位于 `output/<video-id>/<时间-唯一标识>/`，每次尝试独立保存：

- `original.srt / .vtt / .txt`：原语言字幕。
- `zh.srt / .vtt / .txt`：全部翻译完成后生成的简体中文字幕。
- `summary.md`：中文概览与关键要点。
- `transcript.json`：标题、视频 URL、语言、时长、来源及带时间轴的原文/中文段落与摘要。
- `job.json`：任务阶段与失败原因；`result.json`：内部结果快照。

优先读取现有简中、其他中文、原语言、英文字幕；同语言人工字幕优先。无可读字幕时提取音频并本地转写。翻译分批执行，长视频先分段总结再逐层合并。翻译或摘要失败时，已完成的字幕仍会导出；不把部分翻译伪装成完整中文字幕。音频和临时字幕在结束/失败后清理；结果与批次清单持续保留，需自行管理磁盘空间。

## 配置

`channels.example.json` 展示通用配置。包含 `channels`、`keywords`、`exclude_keywords`、`since`、`until`、`limit`、`scan_limit`；命令行参数覆盖配置文件对应字段。

- `--model qwen2.5:3b`：单视频与批次均可指定已安装模型；默认 `qwen2.5:7b`。
- `--output DIR`：单视频/批次处理的结果根目录；discover 命令中则是清单文件。
- `OLLAMA_URL`：默认 `http://127.0.0.1:11434`。
- `OLLAMA_MODEL`：默认语言模型名称。
- `WHISPER_MODEL`：默认 `mlx-community/whisper-small-mlx`，也可设为本地模型路径。

如需给其他程序集成，保留了可选本机 REST API：`./start.sh api`，默认 `127.0.0.1:8765`，无页面。支持 `GET /api/health`、`GET/POST /api/jobs`、`GET /api/jobs/<id>`、`GET /api/jobs/<id>/result`、`GET /api/jobs/<id>/download/<filename>`。POST 请求为 `{"url":"…","model":"qwen2.5:7b"}`。API 仅提供单视频任务；批量发现由命令行负责。API 任务和 CLI 批次各自独立，请避免同时运行以免争用模型资源。API 只绑定回环地址，并检查 Host/Origin；不提供多用户认证。

## 限制与故障

- YouTube 获取与首次模型下载需要网络。默认 AI 推理在本机；若改为远程 `OLLAMA_URL`，字幕将发送到该地址。
- YouTube 的登录验证、429、PO Token 可能导致读取失败。先更新 yt-dlp 再重试；本版本没有 cookies 导入或 PO Token 提供器。
- 某些视频需要 JavaScript runtime；程序会启用可找到的 Node.js，但版本也要符合 yt-dlp 要求。遇到 runtime 警告可安装 Deno：`brew install deno`。
- MLX 转写仅支持 Apple Silicon；已有字幕路径不依赖 MLX。音频下载上限 500MB，视频时长上限 3 小时。
- 各批次内部串行；同一清单有进程锁，不同清单之间没有全局 GPU 锁。CLI 中断后，已经保存的结果仍保留；重新运行可恢复清单，失败项使用 `--retry-failed`。
- 所有结果仅保存本地；整合 JSON 保留视频原始数据，不生成股票观点或自动上传。
- 自动字幕、翻译与摘要均可能出错；引用和重要信息应核对原视频。只处理有权使用的内容。

## 验证

```bash
.venv/bin/python -m unittest discover -s tests -v
.venv/bin/python -m compileall -q pipeline.py youtube_transcribe.py batch.py combine.py sync_kolvex.py server.py whisper_worker.py
```

测试覆盖 URL/频道边界、字幕解析、导出格式、分批翻译与摘要、发现筛选和去重、失败继续、跳过已完成与重试，以及可选 API。整合命令另用现有输出目录和 15 视频 ZIP 验证数据完整性。

参考：[yt-dlp](https://github.com/yt-dlp/yt-dlp)、[MLX Whisper](https://github.com/ml-explore/mlx-examples/tree/main/whisper)、[Ollama Chat API](https://docs.ollama.com/api/chat)。
