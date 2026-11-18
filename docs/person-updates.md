# 人物动态

- 工作台「资讯 → 人物动态」打开 `/dashboard/person-updates`，手机网页从导航菜单进入。公开版在 `/tracker`，两处使用同一时间线和筛选。按发布时间倒序，时间相同按 ID 倒序。人物和标签可以组合筛选。每条显示人物中文名、标题、摘要、影响等级、主题、股票代码、原文来源、可选头像与配图。PT 为主，另显示 ET 与北京时间，均根据时区和夏令时转换。
- Muse 使用现有管理员账号密码登录，打开 `/dashboard/admin?tab=person-updates`，把 JSON 粘贴到文本框。校验并预览只读。保存会重新验证当前文本并批量写入。清空会清除文本、结果和预览。
- 结果区持续显示逐条错误或保存数量和 ID，直到下一次操作或清空。保存失败时保留 JSON。前台重新打开或刷新即读取最新记录。
- 数据入口是人工粘贴。图片通过 JSON 提交公开可访问的 HTTPS 链接。功能没有抓取、定时任务、文件上传或自动数据源。

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
- `POST /api/v1/admin/person-updates/validate` 与 `POST /api/v1/admin/person-updates` 通过 Next.js 代理转发，并沿用 FastAPI 的 `verify_admin`。
- 数据库迁移 `20261118123410_person_updates.sql` 创建唯一内容表 `public.person_updates`。迁移 `20261118192108_person_updates_avatar.sql` 在同一张表新增可空头像列。表启用 RLS，只有后台 `service_role` 具备读写所需权限。
- 当前为 Web 功能，App 可通过浏览器访问公开页。
