# X 推文数据

首批目标：`https://x.com/MentoviaX`。

默认由本机 Playwright 定时任务（macOS LaunchAgent）每 2 小时采集公开 Posts，导入 Kolvex 生产库，再执行 DeepSeek 逐帖分析和媒体归档。整个流程不调用 Codex 或其他 AI 来操作浏览器。设置方法见下文「Playwright 自动同步」，停止规则见 [COLLECTOR.md](./COLLECTOR.md)。

## 最初手工导出

- `data/MentoviaX-2026-10-26.json`：25 条近期非置顶推文；原文、UTC 时间、推文 ID、来源链接、正文中的股票标签、互动数、引用文本和图片页面链接。
- `data/MentoviaX-2026-10-26.csv`：相同数据，额外提供洛杉矶本地时间。
- `state/MentoviaX.json`：已采集 ID 和最新 ID，用于后续批次去重；它本身不会执行采集。

已展开所采集长文，25 条均无未展开标记。保存文件中的正文、时间、引用文本、链接和互动标签与浏览器读取结果的组合校验值一致。JSON 中 ID 保持字符串，避免长整数精度损失。

本批次不是完整历史或完整自然日数据。时间线中未加载的内容、Replies/Reposts/订阅专栏不在此次范围内。图片仅保存来源页面链接，没有下载图片或识别图表；部分图片属于引用帖。互动数是采集时的快照，未显示的值使用 null，不假定为零。

后续增量采集应先读取 `state/MentoviaX.json`，从主页顶部获取新内容，按推文 ID 去重，并在核对和保存成功后更新检查点。需要补齐历史时应保留分页与停止位置，不能只靠最新 ID 判断历史已完整。

原始数据和检查点被本目录 `.gitignore` 排除，不包含登录 Cookie、Token 或其他账号凭证。

## Playwright 自动同步（默认）

入口为 `run.sh`，由 Python 编排 Playwright 采集、生产入库、DeepSeek 逐帖分析和媒体归档。浏览器操作不调用 Codex 或其他模型；只有入库后的逐帖摘要使用后端 `DEEPSEEK_API_KEY`。浏览器使用独立 Chrome 配置目录，由用户首次手动登录 X。脚本只读取公开时间线和详情页的渲染 DOM。

### 浏览器模式

- `dedicated`（默认）：Playwright 自己启动一个专用 Chrome 配置目录，需要在其中单独登录 X（`run.sh login`）。
- `daily`：连接你正在使用、已登录 X 的日常 Chrome。用 `./side-projects/x-posts/run.sh install --browser daily` 切换，设置会被记住。新版 Chrome 不允许自动化程序直接打开日常配置，所以需要你在日常 Chrome 打开 `chrome://inspect/#remote-debugging`，手动勾选「允许远程调试」，页面出现 `Server running at 127.0.0.1:9222` 才算生效。
  - **常驻连接**：Chrome 每次被连接都会弹窗确认，所以 `install --browser daily` 会另装一个 LaunchAgent `app.kolvex.x-posts.browser`（`browser.mjs serve`，KeepAlive）。它连接一次、你点一次允许，之后一直保持连接；每 2 小时的定时任务通过仅当前用户可读写的 Unix socket（`~/Library/Application Support/Kolvex/x-browser.sock`）请求它采集，不再弹窗。
  - 需要再次点允许的情况：Chrome 退出重开、电脑重启、重新 `install`、常驻进程崩溃被重启。常驻进程每 30 秒检查 Chrome 是否重新开启了调试端口，并立即重连，好让弹窗出现在你刚打开 Chrome 时；弹窗无人确认则 15 分钟后再试。
  - 脚本只新开并关闭自己的标签页，结束时只断开连接，不关闭 Chrome，也不读取 Cookie。日志在运行目录 `state/browser-daemon.log`。
  - 风险：开关打开期间，本机任何程序都能操控这个已登录的浏览器；常驻连接也让 Kolvex 一直保持对它的控制。不需要时请执行 `run.sh pause`（同时停掉常驻进程）并关掉开关。
  - 采集时会在日常 Chrome 里短暂打开 X 标签页。Chrome 未运行、开关未开、弹窗未确认或常驻进程未运行时，本轮标记为 `daily_chrome_unavailable`，下一轮再试。

**切换前先停用 Codex 自动化 `x-kolvex`**（在 Codex 桌面应用里关闭），否则两套采集会同时运行。两者共用检查点和数据库 ID 去重，不会写入重复帖子，但会重复打开 X。

### 首次设置

在仓库根目录执行以下命令。后端虚拟环境与 `kolvex-backend-py/.env` 需要已有有效数据库连接，Node.js 版本至少为 20，并安装 Google Chrome。

```bash
npm --prefix side-projects/x-posts ci --ignore-scripts
./side-projects/x-posts/run.sh install
./side-projects/x-posts/run.sh login
```

`login` 打开专用 Chrome，等待用户手动完成登录。确认登录成功后自动关闭登录窗口，恢复已安装的定时任务并立即开始首轮同步。登录等待最多 15 分钟。若 X 限制登录或要求验证，由用户在浏览器里处理；脚本不会自动提交账号密码或绕过验证。

`install` 创建当前 macOS 用户的 LaunchAgent，默认每 120 分钟运行一次；可用 `./side-projects/x-posts/run.sh install --interval-minutes 60` 调整，最短 30 分钟。重新 `login` 会保留已选间隔。首次安装本身不会立即采集。登录成功会开始首轮；以后由系统调度。无需保持终端打开，但需要本机开机、用户会话与网络可用。机器休眠或用户退出登录期间不能保证采集。专用配置目录可能在运行时打开 Chrome 窗口。

### 日常命令

```bash
# 立即采集、去重并写入生产数据库
./side-projects/x-posts/run.sh run

# 查看最近一次结果
./side-projects/x-posts/run.sh status

# 查看系统定时任务状态
./side-projects/x-posts/run.sh schedule-status

# 添加账号，下一轮自动纳入
./side-projects/x-posts/run.sh add @unusual_whales https://x.com/pelositracker

# 暂停调度，保留配置；再次 install 可恢复
./side-projects/x-posts/run.sh pause

# 卸载调度
./side-projects/x-posts/run.sh uninstall
```

名单和每轮上限优先在网页「管理员 → X 内容 → X 采集」里改（需先执行迁移 `20261126120000_x_crawler_settings.sql`），下一轮生效。`run.sh add` 仍可用：写入的是运行目录的 `sources.json`，后台没有出现过的账号会被一起采集；后台关闭的账号不会因为在 `sources.json` 里而被采集；入库前还会按后台名单再查一次，已关闭或已删除账号的导出留在本地、不上传。采集时顺带读取主页头像、显示名称和简介（`<账号>-profile.json`），入库后只补博主资料里空着的字段，不覆盖后台填写的值。迁移未执行时名单来自 `sources.json` 与生产数据库 `x_creators` 的合并结果。改了 `sync.py` 后需重新执行 `run.sh install` 让运行目录拿到新代码。终端另有 `watch` 命令，可前台循环（`--hours` 指定间隔），使用时应暂停 LaunchAgent。

### 数据与恢复

每轮先恢复以前的导出并重试已保存批次，再生成 `plan.json`。旧运行目录里的完整导出若早于当前检查点（之后已有更新的扫描），恢复时跳过，不会回退检查点。某个旧目录校验失败时只把目录名记入 `workflow.json` 的 `recovery_errors`，本轮照常采集，该目录保留到下一轮再试。Playwright 调用共享采集器 `collect-in-cua.mjs`，按帖子 ID 去重、展开长文、验证非置顶检查点。所有导出先经过 `sync.py ingest` 的相同校验逻辑，再使用已有原子导入流程入库。数据库确认后才更新本地检查点。随后与 `sync.py finish` 一样处理分析队列和媒体清单；即使本轮没有新帖也会重试。分析或归档失败只记录错误类型，不影响已入库正文，下一轮继续。未配置 `DEEPSEEK_API_KEY` 时帖子照常入库，分析留在队列中。

采集异常、缺少账号摘要或扫描未完成时，结果标记 `partial`，可入库完整正文并保留旧边界。订阅者专属帖和经详情页确认只有引用内容的帖记入摘要的 `unavailable`，不入库，也不再阻止检查点；遇到它们时继续向下扫描到旧检查点。完整扫描即使全是已入库帖子，也会提交一个只用于推进检查点的批次（数据库按 ID 跳过，不重复写入）。采集器单轮超时默认 90 分钟（`run --timeout` 可改）。数据库失败记录为 `failed`，数据留在本地，下轮重试。整轮文件锁防止同一终端工作流重叠。

`run` 返回 0 表示全部来源完成安全扫描，返回 1 表示部分完成、失败或已有任务运行。安装后脚本运行目录为 `~/Library/Application Support/Kolvex/x-worker/side-projects/x-posts/`，用于避开 macOS 对 Documents 的后台访问限制。仓库中的 `run.sh` 会自动转发到该目录。首次安装复制已有公开数据和检查点，专用浏览器需要重新手动登录；后续 `install` 更新代码、X 相关后端服务（入库、分析、媒体）及 Supabase/DeepSeek 配置，保留运行数据。运行目录的 `.env` 权限为 600。

结果位于运行目录的 `state/workflow.json` 和每轮目录的 `workflow-result.json`；浏览器日志为 `browser.log`。系统日志为 `state/scheduler.log` 与 `state/scheduler-error.log`。

Chrome 自行保存在运行目录下的专用目录 `state/chrome-profile/` 的登录状态。程序不读取或导出 Cookie、Token、Local Storage，不复制日常 Chrome 配置。该目录及原始数据均被 gitignore 排除。日志也不记录账号密码或数据库密钥。

### 本机设置状态

2026-11-26 用户要求改为 Playwright 自动采集，不再使用 Codex。代码默认间隔改为 2 小时，并补齐入库后的分析与媒体归档。需要本机执行 `install` 和 `login` 才会生效；Codex 自动化需在其应用中手动停用。此前专用 Chrome 的登录曾受到 X 限制，若再次出现需在窗口内手动处理。

### 验证

```bash
kolvex-backend-py/venv/bin/python -m unittest discover -s side-projects/x-posts -p 'test_*.py' -q
node --test side-projects/x-posts/extract-posts.test.cjs side-projects/x-posts/browser.test.mjs
```

详细停止规则见 [COLLECTOR.md](./COLLECTOR.md)。Web 和 App 继续读取现有生产数据库，无需客户端改动。
