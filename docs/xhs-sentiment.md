# 小红书每日情绪

> **状态：一期已在 Web 和后端实现，尚未上线。** 上线前需要在生产库应用迁移 `20261121040000_xhs_daily_sentiment.sql`，再部署后端和 Web，由管理员导入第一天的数据。
>
> 入口：Web `/dashboard/xhs-sentiment`（博主观点下的「小红书」，英文界面显示 RedNote）· 管理 `/dashboard/admin?tab=xhs` · 功能开关 `youtubeOpinions` · App 待移植

## 1. 定位

用户看到的是**每天一份的小红书美股情绪日报**：当天整体情绪如何、大家具体在讨论什么。**不提供帖子 feed**，也不提供博主列表、博主主页或逐条笔记浏览。

帖子只作为**话题的出处**出现：每个话题下列几条代表帖的标题和「打开原帖」链接，用来满足「可追溯」的要求。

数据来源：本机采集流程（已登录的 Chrome + 电脑控制，和 X 采集类似）每天产出一份 JSON，管理员粘贴或上传到后台，先校验预览，再确认导入。流程和 [恐慌与贪婪指数](fear-greed.md)、[动态](person-updates.md) 相同。现有样例 `xiaohongshu-us-stocks-summary-2026-11-20.json`（下称 v1）需要按第 5 节转换成 v2。

### 与退役代码的关系

[功能总表](product/feature-catalog.md) 把后端旧的 `xiaohongshu` 路由目录和「KOL tracker」列为已退役、不得恢复。本功能是**新的内容来源**，挂在博主观点下面：

- 后端新建 `xhs_sentiment.py`，不复用、不注册旧的 `xiaohongshu` 目录。
- 不恢复 KOL tracker 的导航入口或路由。

## 2. 用户能做什么

页面从上到下：

1. **日期**：默认显示最新一天，标题右侧的箭头切到前一个 / 后一个已导入的日期。非最新一天会写进 URL（`?date=2026-11-20`），刷新和分享后能恢复。
2. **近期走势**：最近 30 个已导入日期，从新到旧每天一行：日期、当天五档情绪横条、主要倾向（文字）和「恐慌 + 看空」占比，点某一行跳到那天。只有一天时不显示。
3. **情绪卡片**
   - 「多数帖子」下显示五档里条数最多的一档（如「看空」）；最多的两档条数相同时显示「没有单一倾向」。不设阈值标签，不显示数字分数。
   - 「恐慌 + 看空」合计占比和总条数。
   - 五档分布条，图例每档同时写名称、占比和条数（如「看空 61%（65 条）」），不只靠颜色区分。
   - 当天有 `sentiment.latest` 时可以切换「近 N 小时」和「全部帖子」，默认看近 N 小时。
   - 关键词、样本条数、按标题还是正文分类放在标题旁的 ⓘ 里。
4. **讨论话题**：按热度排序的话题列表，每天大约 5–12 个话题。每个话题显示：
   - 话题名和一两句概括，例如「定投一年利润回吐，开始亏本金」。
   - 话题的情绪倾向，以及相关股票 chip（可以跳到行情页）。
   - 热度：涉及帖子数、评论数（标明是采集时快照）。
   - 展开后看到：几条不带名字的代表评论摘录，以及 1–5 条出处帖子（标题 + 博主昵称 + 打开原帖）。
5. **传言**：单独一栏，每条都标「未经证实」或「已被否认」，有出处的附原帖链接。
6. **页脚**：采集时间和「不构成投资建议」各出现一次；**覆盖说明**为折叠区，展示 `limitations`，例如「特斯拉关键词下多为车型旧帖」「评论为热评抽样，不是全部评论」。

**不做什么**：不做帖子 feed、不做博主目录或主页、不做博主排名或准确率、不显示评论人身份、不在阅读时调用模型、不做自动采集。

## 3. 规则

- **数据来源**：只来自管理员导入，每天一条，重复导入同一天会整条覆盖。覆盖范围由采集决定，不代表小红书全量内容，页面要明说。
- **不显示数字分数**：产品原则要求「强度用文字描述」，所以只显示分布和最大的一档。
- **只导入计数**：占比和「多数帖子」由前端从计数算出。导入里带 `score`、占比、标签或其他未列出的字段，校验会报「未知字段」并拒绝整份文件。
- **可追溯**：每个话题至少要有 1 条带 HTTPS 链接的出处帖子，否则校验失败。概括可以由人写或 AI 写，但必须能找到出处。
- **传言**：`status` 只有 `unverified` 和 `debunked` 两种。没有 `verified`：已被证实的消息不属于传言，应写成话题。传言不进入股票页，也不进 AI 结论。
- **隐私**：评论只保留不带名字的摘录（原话完整保留、不限长度，每个话题最多 5 条）。不存评论人昵称、头像、IP 属地。出处帖子的博主昵称可以显示，因为那是公开发帖人，但不建博主资料。
- **版权**：出处帖子只存标题和链接，不存正文和图片。
- **缺失就是缺失**：赞数、评论数看不清就填 `null`，前台显示「—」，不补 0。
- **权限**：读取接口公开；校验和导入走 Next.js 代理和 FastAPI `verify_admin`。表启用 RLS，`anon` / `authenticated` 没有任何权限，读写都经后端的 `service_role`（与恐慌贪婪指数相同）。

## 4. 导入格式 v2

一天的数据是一个对象（结构如下）。一次导入多天时，把每天的对象放进一个数组 `[ {…}, {…} ]`，见 4.7。

```json
{
  "schema_version": "xhs-daily.v2",
  "date_pt": "2026-11-20",
  "captured_at": "2026-11-20T19:50:00-08:00",
  "sample": { … },
  "sentiment": { … },
  "topics": [ … ],
  "rumors": [ … ],
  "limitations": [ … ]
}
```

UTF-8，一次导入最大 4 MB。整份校验通过才写入。

### 4.1 顶层与 `sample`

| 字段 | 规则 |
| --- | --- |
| `date_pt` | 必填，`YYYY-MM-DD`，不能晚于太平洋时间当天。是主键 |
| `captured_at` | 必填，带时区的 ISO 8601 时间，表示采集结束时间 |
| `sample.keywords` | 必填，非空字符串数组，例如 `["美股","英伟达","特斯拉","纳斯达克","推荐流"]` |
| `sample.posts_scanned` | 必填，非负整数，必须等于 `sentiment.all` 各项之和 |
| `sample.posts_by_keyword` | 可选，`{关键词: 条数}` |
| `sample.deep_read_posts` | 可选，点开读了正文和评论的帖子数 |
| `sample.comments_read` | 可选，读过的评论数 |
| `sample.classified_by` | 必填，`title` 或 `body` |
| `sample.latest_window_hours` | `sentiment.latest` 存在时必填，正整数 |
| `limitations` | 可选，字符串数组，原样展示 |

### 4.2 `sentiment`

| 字段 | 规则 |
| --- | --- |
| `all` | 必填，五档计数 |
| `latest` | 可选，只统计最新窗口内帖子的五档计数 |
| `comments` | 可选，深读评论的五档计数 |

五档（所有计数和 `stance` 都用这几个值）：

| 键 | 中文 | English |
| --- | --- | --- |
| `fear_panic` | 恐慌 | Fear |
| `bearish` | 看空 | Bearish |
| `neutral` | 中性 | Neutral |
| `mixed_cautious_buy` | 分歧 / 谨慎看多 | Mixed |
| `bullish` | 看多 | Bullish |

### 4.3 `topics[]`

每天 1–20 个话题。

| 字段 | 规则 |
| --- | --- |
| `id` | 必填，当天内唯一，小写字母、数字、连字符，例如 `dca-profit-wiped` |
| `title` | 必填，话题名，最多 40 字 |
| `summary` | 必填，一两句概括，最多 200 字 |
| `stance` | 必填，五档之一，表示这个话题整体的情绪倾向 |
| `tickers` | 可选，大写股票代码数组，中文名到代码的映射由采集端完成（英伟达 → NVDA） |
| `heat.posts` | 必填，涉及帖子数，非负整数 |
| `heat.comments` | 可选，涉及评论数，非负整数或 `null` |
| `excerpts[]` | 可选，最多 5 条，每条只有 `text`（评论原话，不限长度，2026-11-21 起取消 60 字上限）和 `likes`（非负整数或 `null`）。**带 `author`、`location` 等身份字段会被拒绝** |
| `sources[]` | 必填，1–5 条出处帖子，见 4.4 |

排序：后端按 `heat.posts` 降序，相同时按 `heat.comments` 降序。

### 4.4 `sources[]`（话题和传言共用）

| 字段 | 规则 |
| --- | --- |
| `note_id` | 必填，小红书笔记 ID |
| `url` | 必填，绝对 HTTPS 链接，主机为 `www.xiaohongshu.com` 或 `xhslink.com`，路径含 `note_id`（`xhslink.com` 短链除外）。`xsec_token` 可选：链接只用来记录出处，不要求读者能打开 |
| `title` | 必填，帖子标题原文 |
| `author_nickname` | 可选，发帖人昵称 |
| `published_at` | 可空，带时区的 ISO 8601。采集端按 `captured_at` 换算相对时间，无法换算时填 `null` |
| `published_raw` | 可选，页面原始时间文本，例如「10小时前」 |
| `comments` | 可选，采集时评论数，非负整数或 `null` |

### 4.5 `rumors[]`

| 字段 | 规则 |
| --- | --- |
| `text` | 必填，传言内容，最多 100 字 |
| `status` | 必填，`unverified` 或 `debunked` |
| `tickers` | 可选 |
| `sources` | 可选，0–3 条，格式同 4.4 |

### 4.6 完整示例

计数和话题内容取自 v1 样例。`note_id`、`url`、昵称是**占位值**，不能导入生产环境。

```json
{
  "schema_version": "xhs-daily.v2",
  "date_pt": "2026-11-20",
  "captured_at": "2026-11-20T19:50:00-08:00",
  "sample": {
    "keywords": ["美股", "英伟达", "特斯拉", "纳斯达克", "推荐流"],
    "posts_scanned": 186,
    "posts_by_keyword": { "美股": 83, "纳斯达克": 33, "特斯拉": 31, "英伟达": 26, "推荐流": 8 },
    "deep_read_posts": 5,
    "comments_read": 56,
    "classified_by": "title",
    "latest_window_hours": 24
  },
  "sentiment": {
    "all": { "fear_panic": 21, "bearish": 94, "neutral": 48, "mixed_cautious_buy": 14, "bullish": 9 },
    "latest": { "fear_panic": 19, "bearish": 65, "neutral": 10, "mixed_cautious_buy": 9, "bullish": 3 }
  },
  "topics": [
    {
      "id": "dca-profit-wiped",
      "title": "定投利润回吐，开始亏本金",
      "summary": "不少人表示定投一年多的利润已经吐完，开始亏本金；少数人认为同样的钱能买更多份额。",
      "stance": "fear_panic",
      "tickers": ["QQQ"],
      "heat": { "posts": 12, "comments": 283 },
      "excerpts": [
        { "text": "勤勤恳恳定投一年多利润全部吐完开始吃我的本金", "likes": 28 },
        { "text": "定投就别想啦，现在你应该想的是同样的钱可以多买一点了。", "likes": 43 }
      ],
      "sources": [
        {
          "note_id": "000000000000000000000001",
          "url": "https://www.xiaohongshu.com/explore/000000000000000000000001",
          "title": "美股纳指，已跌破今年来所有盈利，科技熊市？",
          "author_nickname": "示例博主",
          "published_at": "2026-11-20T09:50:00-08:00",
          "published_raw": "10小时前",
          "comments": 283
        }
      ]
    }
  ],
  "rumors": [
    { "text": "黄仁勋复职失败，英伟达断供中国芯片", "status": "unverified", "tickers": ["NVDA"], "sources": [] }
  ],
  "limitations": [
    "特斯拉关键词下多为车型 / FSD 旧帖，不计入最新情绪",
    "评论为热评抽样（每篇 9–13 条），不是全部评论"
  ]
}
```

### 4.7 一次导入多天

- 顶层为数组，1–31 天，每个元素是 4.1–4.5 描述的一天，顺序不限。
- 每一天都单独校验；任何一天出错，整批都不写，错误前面标明是第几天、哪个日期（如「第 2 天（2026-11-19） topics：数量不足」）。
- 同一批里不能有重复日期。已有数据的日期会被整天覆盖，不做合并。
- 超过 31 天或 4 MB 时分几批导入。

## 5. v1 → v2 转换

v1 最大的变化是：从「帖子列表 + 汇总」改成「汇总 + 话题」。话题需要采集端（或者让 AI 读完 v1 后）归纳出来。

| v1 | v2 | 处理 |
| --- | --- | --- |
| `date_pt` | `date_pt` | 不变 |
| `as_of_pt` | `captured_at` | 补上时区，写成 ISO 8601 |
| `coverage.title_scan_by_keyword` | `sample.posts_by_keyword` | 不变 |
| `coverage.unique_posts_total` | `sample.posts_scanned` | 不变 |
| `coverage.deep_read_posts`、`deep_read_comments_read` | `sample.deep_read_posts`、`sample.comments_read` | 不变 |
| `coverage.title_scan_method`、`deep_read_filter` | — | 采集流程说明，写进采集端 README，不入库 |
| `sentiment_combined_unique.counts` | `sentiment.all` | 只留计数 |
| `sentiment_title_scan_latest_only.counts` | `sentiment.latest` | 只留计数 |
| `sentiment_title_scan`、`score`、`negative_share_pct`、`label`、`formula` | — | 删除，后端计算 |
| `comment_sentiment.counts_approx` | `sentiment.comments` | 把 v1 的键（`buy_dip_contrarian`、`humor_sarcasm`、`questions_practical`）映射到五档 |
| `comment_sentiment.themes`、`deep_read_posts[].comment_evaluation.themes` | `topics[]` | 每个主题写成一个话题，补 `summary`、`stance`、`heat`、`sources` |
| `top_comments[]`、`most_liked_*` | `topics[].excerpts` | 去掉昵称和属地，只留文本和赞数 |
| `deep_read_posts[]`、`posts[]` | `topics[].sources` | 只保留作为出处的那几条，并补 `note_id` 和 `url`；其余帖子只计入 `sentiment.all` |
| `rumor_flags` | `rumors[]` | 改成对象，补 `status`，能找到出处就补 `sources` |
| `honesty_notes` | `limitations` | 只保留给读者看的局限说明；采集过程日志（键盘焦点、会话号）不入库 |
| `posts[].id`、`recency`、`unverified_rumor` | — | 删除 |

## 6. 采集端需要改什么

1. 作为话题出处的帖子，要从卡片链接或详情页地址栏取 `note_id` 和完整 `url`。v1 的 186 条帖子都没有链接。
2. 采集结束后归纳当天的 5–12 个话题。每个话题都要写明出处帖子，不能只写概括。
3. 把相对时间换算成 `published_at`，原文写进 `published_raw`。
4. 评论只输出摘录文本和赞数，不输出评论人昵称和属地。
5. 输出前自检：`posts_scanned == sum(sentiment.all)`；每个话题至少 1 条 `sources`；话题 `id` 不重复；所有链接都是 HTTPS 且路径含 `note_id`。

## 7. 实现

| 层 | 位置 |
| --- | --- |
| 数据库 | `kolvex-backend-py/supabase/migrations/20261121040000_xhs_daily_sentiment.sql`：表 `xhs_daily_sentiment`，主键 `date_pt`，JSONB 列 `sample` / `sentiment` / `topics` / `rumors` / `limitations`，审计列 `imported_by`、`imported_at` |
| 后端 | 路由 `app/api/routes/xhs_sentiment.py`（公开路由在 `api_router`，管理路由挂在 `/admin`）；校验 `app/schemas/xhs_sentiment.py`；测试 `tests/test_xhs_sentiment.py` |
| Web | 页面 `app/dashboard/xhs-sentiment/page.tsx` → `components/xhs/XhsSentimentPage.tsx`；单日内容 `components/xhs/XhsDayView.tsx`（阅读页和后台预览共用）；数据与计算 `lib/xhsSentiment.ts`；代理 `app/api/xhs-sentiment/route.ts`、`app/api/xhs-sentiment/[date]/route.ts`、`app/api/admin/xhs-sentiment/route.ts`；后台 `components/admin/XhsSentimentImporter.tsx`；导航 `components/layout/navItems.ts` 的 `OPINION_SOURCES`；测试 `scripts/xhs-sentiment.test.cjs` |
| App | 未实现，已登记在 `kolvex-mobile/MIGRATION.md` |

接口（统一前缀 `/api/v1`）：

| 方法 | 路径 | 权限与用途 |
| --- | --- | --- |
| GET | `/xhs-sentiment/days?limit=30` | 公开，按日期倒序返回每天的计数和样本信息（limit 1–90），不含话题，用于走势和日期切换 |
| GET | `/xhs-sentiment/days/{date_pt}` | 公开，单日完整内容；没有这一天返回 404，日期格式错误返回 422 |
| POST | `/admin/xhs-sentiment/validate` | 管理员，只校验不写入。请求体为一天的对象或多天的数组；返回 `days`，按日期倒序，每天含规范化后的内容和 `replaces_existing`（这一天是否已有数据） |
| POST | `/admin/xhs-sentiment` | 管理员，重新校验后在一条 upsert 语句里写入全部日期（全部成功或全部不写），返回 `dates` 和话题总数 |

后台流程：「复制提示词」把采集提示词复制给能用浏览器的 AI（Codex、Muse 等），也可以「查看提示词」手动选取；剪贴板被浏览器拦住时会提示并展开全文。提示词按界面语言提供中文或英文版，自动填入太平洋时间的当天日期，内容包括采集步骤、第 3 节的规则、第 4 节的结构和输出前自检，代码在 `lib/xhsSentiment.ts` 的 `buildXhsCollectionPrompt`。改导入格式时要同时改提示词，`scripts/xhs-sentiment.test.cjs` 会检查提示词里有每个必填字段、没有会被拒绝的字段。

然后粘贴 JSON，或点「选择 JSON 文件」一次选多个文件（每个文件可以是一天或多天，读入后合成一个数组放进编辑框）→「校验并预览」→ 预览通过后才能点保存。多天时预览上方列出每一天（日期、话题数、帖子数、是否将覆盖），点哪天就按阅读页样式显示哪天。已有数据的日期会列在红色提示里，保存按钮写明「保存 N 天（覆盖 M 天）」；只有一天时按钮为「保存」或「覆盖已保存的这一天」。改动文本会清掉预览，需要重新校验。

一张表、一条记录对应一天，没有帖子表和博主表。以后如果要做「今天哪些话题提到 NVDA」，可以在 `topics` 上加 GIN 索引，或者再拆一张话题表。

导航：博主观点下新增第四个来源。仓库里没有小红书官方标志，暂用 lucide `BookHeart` 图标代替。

出处链接（2026-11-20 起）：

实测：不带 `xsec_token` 的 `/explore/<id>` 和 `/discovery/item/<id>` 都会跳到小红书 404 页（error_code 300031「当前笔记暂时无法浏览」）。所以：

- 2026-11-21 起，导入不再要求 `xsec_token`：链接只用来记录出处（`note_id` 可追溯），不要求读者能打开。采集提示词改为可直接写 `/explore/<note_id>`，不必为取 token 反复点开帖子。
- 页面上，没有 `xsec_token` 的出处只显示标题和元信息，不显示「打开原帖」链接，避免点进死链；带 token 的链接和 `xhslink.com` 短链照常可点。

## 8. 待确认的问题

- 话题由谁归纳：采集端 AI 写进 JSON（本方案的假设），还是导入后由后端调用 DeepSeek 生成（会花钱，只能在管理员点击后触发）。
- 页面放在博主观点的「小红书」tab，还是和 Reddit 热度合成「社区情绪」。

## 9. 验证

- 已验证：
  - `cd kolvex-backend-py && venv/bin/python -m pytest tests/test_xhs_sentiment.py`：30 项通过（校验规则、出处链接、拒绝评论人身份字段、多天批量：倒序、重复日期、单天出错整批拒绝、一次 upsert 写入全部日期；预览不写库、保存带审计字段、公开读取的 404 / 422）。
  - `cd kolvex-frontend-web-nextjs && npx tsc --noEmit`、改动文件的 `next lint`、`node --test scripts/xhs-sentiment.test.cjs`（占比、多数一档、日期前后切换、日期路径、太平洋日期换算、中英文提示词字段齐全、多文件合并）通过。
  - 本地预览：Web 开发服务器接本地 mock 后端（示例数据，不连生产库），因 `/dashboard` 需要登录，临时用一个不受保护的路由渲染同一页面组件，看完已删除。看过桌面宽度和 390px 宽度、深色和浅色、展开话题、日期切换和 URL、不存在的日期、后端不可用时的重试提示；390px 无横向滚动。
- 未验证：
  - 登录后的 `/dashboard/xhs-sentiment`（侧栏、手机顶部的来源切换条，四个来源在 390px 下是否放得下）。
  - 提示词区域在临时路由里看过（桌面和 390px、展开 / 收起、复制失败提示）。预览浏览器禁止写剪贴板，**复制成功**的路径没有看到。
  - 后台导入页的批量预览在临时路由里看过（桌面和 390px）：页面内替换了校验请求的返回，用 mock 后端的三天数据，看到日期列表倒序、切换预览、覆盖提示和「保存 3 天（覆盖 1 天）」。真实的校验 / 保存请求需要管理员登录，没有在浏览器里走过。
  - 「选择 JSON 文件」按钮：系统文件选择框无法自动操作，只有合并逻辑的单元测试。
  - 迁移没有在任何数据库上执行过。
  - 英文界面只核对了代码里的文案，没有截图。
- 已核对 v1 样例：186 条帖子，无一条带链接或笔记 ID；`sentiment_combined_unique` 各项之和为 186，`latest_only` 之和为 106。v1 不能直接导入，要先按第 5 节转换。
