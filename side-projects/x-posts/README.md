# X 推文数据

首批目标：`https://x.com/MentoviaX`。

默认由 AI 通过 cua_repl 操作已登录的日常 Chrome，每 3 小时采集公开 Posts 并同步到生产数据库。操作规程见 [COLLECTOR.md](./COLLECTOR.md)。

## 最初手工导出

- `data/MentoviaX-2026-10-26.json`：25 条近期非置顶推文；原文、UTC 时间、推文 ID、来源链接、正文中的股票标签、互动数、引用文本和图片页面链接。
- `data/MentoviaX-2026-10-26.csv`：相同数据，额外提供洛杉矶本地时间。
- `state/MentoviaX.json`：已采集 ID 和最新 ID，用于后续批次去重；它本身不会执行采集。

已展开所采集长文，25 条均无未展开标记。保存文件中的正文、时间、引用文本、链接和互动标签与浏览器读取结果的组合校验值一致。JSON 中 ID 保持字符串，避免长整数精度损失。

本批次不是完整历史或完整自然日数据。时间线中未加载的内容、Replies/Reposts/订阅专栏不在此次范围内。图片仅保存来源页面链接，没有下载图片或识别图表；部分图片属于引用帖。互动数是采集时的快照，未显示的值使用 null，不假定为零。

后续增量采集应先读取 `state/MentoviaX.json`，从主页顶部获取新内容，按推文 ID 去重，并在核对和保存成功后更新检查点。需要补齐历史时应保留分页与停止位置，不能只靠最新 ID 判断历史已完整。

原始数据和检查点被本目录 `.gitignore` 排除，不包含登录 Cookie、Token 或其他账号凭证。

## 默认 AI 定时同步

Codex 自动化 `x-kolvex` 已恢复为每 3 小时执行一次。每轮按 [COLLECTOR.md](./COLLECTOR.md) 准备合并名单、读取公开时间线、展开长文并入库。依赖本机、Codex、浏览器扩展和已登录 Chrome 可用，会消耗模型用量。独立 Playwright LaunchAgent 保持暂停。

## 无 AI 的自动同步

以下保留为可选的手动方案，目前未启用。入口为 `run.sh`，由 Python 编排 Playwright 采集和生产入库，不调用 Codex 或其他模型。浏览器使用独立 Chrome 配置目录，由用户首次手动登录 X。脚本只读取公开时间线和详情页的渲染 DOM。

### 首次设置

在仓库根目录执行以下命令。后端虚拟环境与 `kolvex-backend-py/.env` 需要已有有效数据库连接，Node.js 版本至少为 20，并安装 Google Chrome。

```bash
npm --prefix side-projects/x-posts ci --ignore-scripts
./side-projects/x-posts/run.sh install
./side-projects/x-posts/run.sh login
```

`login` 打开专用 Chrome，等待用户手动完成登录。确认登录成功后自动关闭登录窗口，恢复已安装的定时任务并立即开始首轮同步。登录等待最多 15 分钟。若 X 限制登录或要求验证，由用户在浏览器里处理；脚本不会自动提交账号密码或绕过验证。

`install` 创建当前 macOS 用户的 LaunchAgent，每 30 分钟运行一次，时间间隔为 1800 秒。首次安装本身不会立即采集。登录成功会开始首轮；以后由系统调度。无需保持终端打开，但需要本机开机、用户会话与网络可用。机器休眠或用户退出登录期间不能保证采集。专用配置目录可能在运行时打开 Chrome 窗口。

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

名单来自 `sources.json` 与生产数据库 `x_creators` 的合并结果。当前 Codex 桌面自动化 `x-kolvex` 已启用，独立 Playwright 调度保持暂停；重新选择无 AI 方案时需停用 Codex 定时入口，避免重复采集。终端另有 `watch` 命令，可前台每 30 分钟循环，使用时应暂停 LaunchAgent。

### 数据与恢复

每轮先恢复以前的导出并重试已保存批次，再生成 `plan.json`。Playwright 调用共享采集器 `collect-in-cua.mjs`，按帖子 ID 去重、展开长文、验证非置顶检查点。所有导出先经过 `sync.py ingest` 的相同校验逻辑，再使用已有原子导入流程入库。数据库确认后才更新本地检查点。

采集异常、缺少账号摘要或扫描未完成时，结果标记 `partial`，可入库完整正文并保留旧边界。数据库失败记录为 `failed`，数据留在本地，下轮重试。整轮文件锁防止同一终端工作流重叠。

`run` 返回 0 表示全部来源完成安全扫描，返回 1 表示部分完成、失败或已有任务运行。安装后脚本运行目录为 `~/Library/Application Support/Kolvex/x-worker/side-projects/x-posts/`，用于避开 macOS 对 Documents 的后台访问限制。仓库中的 `run.sh` 会自动转发到该目录。首次安装复制已有公开数据和检查点，专用浏览器需要重新手动登录；后续 `install` 更新代码及数据库连接配置，保留运行数据。

结果位于运行目录的 `state/workflow.json` 和每轮目录的 `workflow-result.json`；浏览器日志为 `browser.log`。系统日志为 `state/scheduler.log` 与 `state/scheduler-error.log`。

Chrome 自行保存在运行目录下的专用目录 `state/chrome-profile/` 的登录状态。程序不读取或导出 Cookie、Token、Local Storage，不复制日常 Chrome 配置。该目录及原始数据均被 gitignore 排除。日志也不记录账号密码或数据库密钥。

### 本机设置状态

2026-11-18 用户要求每次使用 AI 采集，Codex 自动化已恢复为每 3 小时一次。独立 Playwright 调度保持暂停。后台 launchd 到 shell 和 Python 的调用此前已实测，专用 Chrome 的登录仍曾受到 X 限制。

### 验证

```bash
kolvex-backend-py/venv/bin/python -m unittest discover -s side-projects/x-posts -p 'test_*.py' -q
node --test side-projects/x-posts/extract-posts.test.cjs side-projects/x-posts/browser.test.mjs
```

详细停止规则见 [COLLECTOR.md](./COLLECTOR.md)。Web 和 App 继续读取现有生产数据库，无需客户端改动。
