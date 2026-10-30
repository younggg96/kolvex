# X 推文数据

首批目标：`https://x.com/MentoviaX`。

通过已登录 Chrome 的公开 Posts 时间线采集原文，不依赖 yt-dlp 或 X API。现已提供 DOM 提取器、持久化与增量同步命令，由 Codex 本地每小时定时工作流调用；不是独立的无人值守 shell 爬虫。操作规程见 [COLLECTOR.md](./COLLECTOR.md)。

## 最初手工导出

- `data/MentoviaX-2026-10-26.json`：25 条近期非置顶推文；原文、UTC 时间、推文 ID、来源链接、正文中的股票标签、互动数、引用文本和图片页面链接。
- `data/MentoviaX-2026-10-26.csv`：相同数据，额外提供洛杉矶本地时间。
- `state/MentoviaX.json`：已采集 ID 和最新 ID，用于后续批次去重；它本身不会执行采集。

已展开所采集长文，25 条均无未展开标记。保存文件中的正文、时间、引用文本、链接和互动标签与浏览器读取结果的组合校验值一致。JSON 中 ID 保持字符串，避免长整数精度损失。

本批次不是完整历史或完整自然日数据。时间线中未加载的内容、Replies/Reposts/订阅专栏不在此次范围内。图片仅保存来源页面链接，没有下载图片或识别图表；部分图片属于引用帖。互动数是采集时的快照，未显示的值使用 null，不假定为零。

后续增量采集应先读取 `state/MentoviaX.json`，从主页顶部获取新内容，按推文 ID 去重，并在核对和保存成功后更新检查点。需要补齐历史时应保留分页与停止位置，不能只靠最新 ID 判断历史已完整。

原始数据和检查点被本目录 `.gitignore` 排除，不包含登录 Cookie、Token 或其他账号凭证。

## 自动同步

`sources.json` 是起始博主配置；每轮同时合并 Kolvex 数据库 `x_creators` 中的博主。当前起始账号为 MentoviaX。

```bash
# 查看名单与安全停止边界
kolvex-backend-py/venv/bin/python side-projects/x-posts/sync.py plan
# 先校验浏览器采集的一个博主导出
kolvex-backend-py/venv/bin/python side-projects/x-posts/sync.py ingest /absolute/path/to/export.json
# 提交保存的批次；失败不会删除原始数据
kolvex-backend-py/venv/bin/python side-projects/x-posts/sync.py sync
# 运行增量与失败恢复测试
kolvex-backend-py/venv/bin/python -m unittest discover -s side-projects/x-posts -p test_sync.py -q
```

`sync.py` 不驱动浏览器。浏览器采集由 Codex 定时工作流按 COLLECTOR.md 完成，再调用此脚本入库。脚本仅从后端 `.env` 读取数据库服务密钥，不读取 X 登录凭证。命令使用文件锁避免重叠写入，文件通过临时文件原子替换；检查点只在数据库提交后推进。

限量扫描遇到缺口时可以保存已采集原文，但不推进回溯边界。长文未展开时禁止提交。置顶旧帖不作为停止依据。旧手工快照的 seen_post_ids 仅作为初始回溯边界，synced_post_ids 独立记录数据库确认成功的 ID，避免“采集过但没入库”的内容被漏掉。

## 当前运行状态

已创建并启用「同步 X 博主推文到 Kolvex」每小时本地定时任务（自动化 ID：`x-kolvex`）。2026-10-29 洛杉矶时间首轮采集 124 条，补全 21 条长文，新增入库 123 条；与原始 25 条快照合计 148 条。定时任务使用当前聊天作为执行入口，无更新时不提醒。

数据表迁移已应用到项目 Supabase。线上展示需要同时发布前端 X 页面与后端 API；本地采集不依赖页面服务运行。
