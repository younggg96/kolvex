# 小红书每日情绪 · 本机自动采集

每天由本机 Playwright 定时任务（macOS LaunchAgent）在专用 Chrome 配置目录里读取小红书搜索结果，再用 DeepSeek V4.1 Flash（`deepseek-flash`）给帖子标情绪、归纳话题，经过与后台导入**相同的校验**后写入 `xhs_daily_sentiment`。功能说明见 [docs/xhs-sentiment.md](../../docs/xhs-sentiment.md)。

浏览器操作不调用任何模型；模型只看采集到的文字，不操作浏览器。

## 首次设置

```bash
# 1. 安装定时任务（复制运行文件到 ~/Library/Application Support/Kolvex/xhs-worker/）
./side-projects/xhs-daily/run.sh install

# 2. 在弹出的专用 Chrome 里登录小红书（建议用小号，不要用主号）
./side-projects/xhs-daily/run.sh login

# 3. 先试一轮：只采集，不调模型、不写库，看 data/run-*/raw.json
./side-projects/xhs-daily/run.sh run --force --no-ai

# 4. 再试一轮：采集 + DeepSeek + 校验，结果写到 data/run-*/digest.json，不写库
./side-projects/xhs-daily/run.sh run --force --dry-run
```

`install` 需要后端 `.env` 里有 `SUPABASE_URL`、`SUPABASE_SERVICE_KEY` 和 `DEEPSEEK_API_KEY`，会写进运行目录下权限为 600 的 `.env`。运行目录的路径是 `~/Library/Application Support/Kolvex/xhs-worker/side-projects/xhs-daily/`（`data/`、`state/` 都在这里）；仓库里的 `run.sh` 安装后会自动转发过去。改了代码后需要重新 `install`。

## 调度规则

- LaunchAgent 每小时唤醒一次；只有**太平洋时间 19:00 以后**、并且当天还没成功时才采集。电脑休眠错过了，醒来后会补跑；不受本机时区和夏令时影响。
- 每天最多尝试 2 次。遇到**验证码、安全验证或登录页**，当天直接停止，不重试，也不尝试绕过。需要你打开专用 Chrome 手动处理，然后运行 `run.sh run --force`，或者等第二天。
- 当天如果管理员已经在后台手动导入过，采集器不会覆盖，采集前和写库前各查一次。反过来，管理员之后再导入同一天，会覆盖自动结果。
- 任何一步失败（采集不完整、模型输出不完整、校验不通过）当天都不写库，页面上就是缺这一天。

## 采集内容

| 步骤 | 内容 |
| --- | --- |
| 搜索 | 默认关键词：美股、英伟达、特斯拉、纳斯达克；尝试切到「最新」排序，每个关键词翻 4 屏，按 note_id 去重 |
| 深读 | 优先选 24 小时内、赞数高、带 `xsec_token` 的 5 篇，打开详情页读正文和前 15 条热评 |
| 隐私 | 评论只读原文和赞数，**不读**评论人昵称、头像、IP 属地 |
| 版权 | 正文只发给模型做归纳，不入库；入库的出处只有标题和链接 |

关键词和数量可以在运行目录放一个 `config.json` 覆盖：

```json
{ "keywords": ["美股", "英伟达", "特斯拉", "纳斯达克"], "scrollsPerKeyword": 4, "deepReads": 5, "commentsPerPost": 15 }
```

## 防编造

模型只负责打标签和分组，最终的 JSON 由 `digest.py` 拼出来：

- 五档计数由脚本按模型的逐条标签累加。只要有一条帖子没拿到标签，整轮就失败，不会猜。
- 话题出处只能是当天采到、且被判为美股相关的 note_id，链接由脚本根据卡片地址重建；模型编出来的 ID 一律丢弃。没有出处的话题直接删掉。
- 评论摘录只能引用采集到的评论 ID，原文由脚本填进去，模型不能改写。
- 话题的评论数只有在所有成员帖都打开过时才填，否则填 `null`，不拿部分和充数。
- `limitations` 固定写明「由 AI 自动生成」以及热评是抽样。

## 常用命令

```bash
./side-projects/xhs-daily/run.sh status           # 最近一轮结果
./side-projects/xhs-daily/run.sh run --force      # 立即跑一轮（会写库）
./side-projects/xhs-daily/run.sh schedule-status  # launchd 状态
./side-projects/xhs-daily/run.sh pause            # 暂停，再次 install 恢复
./side-projects/xhs-daily/run.sh uninstall        # 卸载
```

## 测试

```bash
cd side-projects/xhs-daily
../../kolvex-backend-py/venv/bin/python -m pytest test_digest.py test_workflow.py
node --test collect.test.mjs
```

## 已知局限

- 页面选择器（`collect.mjs` 的 `SELECTORS`）来自小红书网页版，**还没有在登录状态下实测过**。第一次请用 `--no-ai` 跑，检查 `raw.json` 和 `browser.log`。小红书改版后，`status` 会显示 `empty` 或带 `no_cards:<关键词>` 警告。
- 「最新」排序是模拟鼠标悬停「筛选」再点击，切换失败会记一个警告，并在页面的覆盖说明里写明。
- 专用 Chrome 运行时会弹出窗口；机器休眠或用户退出登录期间不会采集。
