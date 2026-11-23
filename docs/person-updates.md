# 动态

> 原名「人物动态」，界面统一改称「动态」（英文 Updates）。路由、表名和接口名不变。

- 工作台「资讯 → 动态」打开 `/dashboard/person-updates`，手机网页从导航菜单进入。公开版在 `/tracker`，两处使用同一时间线和筛选。按发布时间倒序，时间相同按 ID 倒序。人物和标签可以组合筛选。每条显示人物中文名、标题、摘要、影响等级、主题、股票代码、原文来源、可选头像与配图。姓名下默认显示 PT 时间，点开可对照 PT、ET 与北京时间，均根据时区和夏令时转换。股票代码单独成行，使用站内统一的股票 chip，可进入相应行情页。主题与原文共用下一行。
- 桌面和手机网页均可横向浏览人物头像。选中头像立即按人物筛选，「全部人物」恢复人物范围。品牌色头像圈表示过去 24 小时内有动态，悬停提示和读屏标签提供条数。头像下的短线表示当前筛选。只有徽章、没有站内固定头像的美联储官员在头像栏合并成一个「美联储官员」头像，放在其中最新动态的位置；选中后显示全部美联储官员的动态（含有固定头像的官员，如沃什），URL 为 `?person=fed`，动态提示圈的条数也按全部官员合计。筛选面板的人物列表同样提供「美联储官员」选项，单个官员仍可在面板中单独选择。
- 头像优先级：站内固定头像（`public/person-updates/`，在 `lib/personUpdates.ts` 的 `PERSON_AVATARS` 中按英文名或中文名匹配，目前有凯文·沃什、黄仁勋、习近平、普京）→ 美联储官员一律用美联储理事会徽章 → JSON 的 `avatar_url` → 姓名首字。美联储官员在时间线、头像栏和后台使用徽章，图片加载失败时退回 FED 字标。名单依据 [Fed 会议纪要](https://www.federalreserve.gov/monetarypolicy/fomcminutes20261028.htm)，名单外可在 JSON 的 `tags` 中明确写入 `美联储官员` 或 `Fed official`。头像栏以该人物最新一条动态为准。
- 「筛选」打开站内筛选面板，人物和主题可组合使用。选择即时生效，「完成」关闭面板，「重置」清除人物与主题。筛选条件随 URL 保留。
- 管理员打开 `/dashboard/admin?tab=person-updates`。「已保存动态」列出全部记录，可「新增动态」、逐条编辑（表单，ID 不可改）或删除（二次确认，不可恢复）。新增时 ID 按英文名和日期自动生成。表单保存走同一个 upsert 接口与校验。
- 批量导入：打开「新增动态 → 上传 JSON」，选择本地 `.json` 文件或直接粘贴 JSON。文件内容会填入可编辑的文本框。校验并预览只读。保存会重新验证当前文本、批量写入并刷新「已保存动态」。清空会清除文本、结果和预览。
- 结果区持续显示逐条错误或保存数量和 ID，直到下一次操作或清空。保存失败时保留 JSON。前台重新打开或刷新即读取最新记录。
- 文件内容在浏览器内读取，校验或保存时提交 JSON 文本。图片通过 JSON 提交公开可访问的 HTTPS 链接。

## JSON 格式与校验

顶层为 `{"items": […]}`。每批 1–500 条，UTF-8 JSON 最大 2 MB。

| 字段 | 规则 |
| --- | --- |
| `id` | 必填，1–128 字符，小写字母和数字，可用单个连字符分隔 |
| `person`、`person_cn` | 必填的非空字符串。按 `person` 分组，因此同一人物应使用同一英文名 |
| `published_at` | 必填，使用带秒和时区的 ISO 8601 时间。可带最多六位小数秒，时区为 `Z` 或 `±HH:MM` |
| `title`、`summary` | 必填的非空字符串，原文展示 |
| `source_url` | 必填，绝对 HTTPS 原文链接 |
| `impact` | 必填，`high`、`medium`、`low` 三选一 |
| `tags`、`tickers` | 非空字符串数组，可省略，默认空数组 |
| `avatar_url` | 可选头像，使用浏览器可直接打开的绝对 HTTPS 图片地址，缺图或加载失败时显示姓名首字 |
| `image_url`、`image_alt` | 配图可省略。填写图片地址时须提供图片描述。使用浏览器可直接打开的绝对 HTTPS 图片地址 |

把以下字段并入动态对象即可附图。地址需换成实际图片链接。

```json
{
  "avatar_url": "https://example.com/portrait.jpg",
  "image_url": "https://example.com/event.jpg",
  "image_alt": "人物在会议上发言"
}
```

同一批次的重复 ID 拦截整批。跨批次的同 ID 通过主键 upsert 覆盖原记录。省略原有头像或配图字段会移除对应图片。浏览器从源站加载配图，图片失败时仍显示正文。

## 接口与权限

- `GET /api/v1/person-updates` 公开读取，两处时间线打开时按需请求。
- `POST /api/v1/admin/person-updates/validate`、`POST /api/v1/admin/person-updates`（批量或单条 upsert）与 `DELETE /api/v1/admin/person-updates/{id}` 通过 Next.js 代理转发，并沿用 FastAPI 的 `verify_admin`。删除不存在的 ID 返回 404。
- 数据库迁移 `20261118123410_person_updates.sql` 创建唯一内容表 `public.person_updates`。迁移 `20261118192108_person_updates_avatar.sql` 在同一张表新增可空头像列。迁移 `20261119090000_person_updates_delete.sql` 给 `service_role` 增加删除权限。表启用 RLS，只有后台 `service_role` 具备读写所需权限。
- 当前为 Web 功能，App 可通过浏览器访问公开页。
