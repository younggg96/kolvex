# 设计规范（跨端总览）

> Web 和 App 共用的设计原则，以及到各端详细规范的导航。
> 详细规范：Web `kolvex-frontend-web-nextjs/DESIGN.md`（1800+ 行，按 §7 的章节表只读相关部分）、App `kolvex-mobile/DESIGN.md`。
> 交互和状态归属：Web `UX-CONTRACT.md`、App `UX-CONTRACT.md`。
> **颜色、圆角等数值以 `kolvex-frontend-web-nextjs/app/globals.css` 为准**；本文和 `DESIGN.md` 里出现的数值只是快照。

## 1. 设计方向

- **定位**：面向零售投资者的产品界面，以 Robinhood 的完成度为标准。是工具，不是营销页。
- **核心视觉**：股票代码旁边放证据和涨跌方向。绿色只用于品牌操作和当前导航。
- **气质**：平静、可快速扫读、中文优先。不用装饰性渐变，不用夸张动效，不用终端风格，不把研究库做成宣传头图或指标大屏。
- **不编造**：界面里不出现虚构的博主、收益、用户数或推荐语。演示数据必须明确标注。

## 2. Token 与颜色

**归属链**：`app/globals.css`（语义变量）→ `tailwind.config.ts`（工具类）→ Web 组件；App 的 `src/lib/palette.ts` 镜像同一套变量，由 `tests/theme-parity.test.ts` 校验。

| 角色 | Token | 用途 |
| --- | --- | --- |
| 品牌 / 主操作 | `--primary`、`--primary-hover` | 主按钮、当前导航。深色模式为 `#00C805` |
| 背景 / 卡片 | `--background`、`--card` | 浅色：淡绿底 + 白卡片；深色：纯黑底 + `#0E0F10` 卡片 |
| 正文 / 次要文字 | `--foreground`、`--muted-foreground` | |
| 浅色填充上的次要文字 | `--muted-on-tint`（App：`secondaryOnTint`） | 灰字放在 tint / muted 填充上时用它，普通次要文字在那里达不到 AA 对比度 |
| 中性填充 | `--muted`（App：`tint`；深色对应 `--secondary`） | 表头、分组行、芯片、选中态。Web 浅色 `--secondary` 是绿色选中色，App 不用 |
| 边框 | `--border` | 输入框边缘、表格分隔线 |
| 涨 / 跌文字 | `--positive`、`--negative` | 小号文字，用对比度足够的深色 |
| 涨 / 跌填充、图表 | `--positive-fill`、`--negative-fill`、`--chart-up`、`--chart-down` | 图表和色块，不用来写小字 |

规则：
- **组件里不写死 hex**，只用语义 token。
- **涨跌不能只靠颜色**：必须同时有正负号、文字或图标。
- **选中态用中性填充，不用绿色铺底**（绿色留给品牌操作）。
- 浅色和深色两套都必须支持，改了颜色两种模式都要看。

## 3. 字体、形状、间距

| | Web | App |
| --- | --- | --- |
| 字体 | Inter + 中文回退（PingFang SC、Hiragino Sans GB、Microsoft YaHei、Noto Sans SC） | 系统字体，支持系统字号缩放 |
| 数字 | `tabular-nums` / `figure` | 等宽数字 |
| 字号参考 | 研究标题 28→32px、导航 14px 半粗、元信息 12px | 大标题 36、价格 48、分区 20、正文 16、元信息 12/14 |
| 圆角 | 输入框、按钮、导航、分段控件用胶囊形；卡片、弹窗 24px；行、菜单 16px | 面板 24pt（`Glass` 内置） |
| 页面边距 | 手机 16px、桌面 32px | 24pt |
| 间距 | 分区间距 48px | 分区 24pt、行 16pt、相关元素 8pt |
| 最小点击区域 | 44px | 44pt |

- 中文行高要留够，描述文字允许换行，不要固定文字高度。
- Web 手机宽度下根字号 14px（1rem = 14px），App 对照 Web 时的换算见 [web-mobile-parity.md §3](../engineering/web-mobile-parity.md#3-尺寸换算web-手机宽度--app)。

## 4. 组件归属

**先用已有组件，没有再新建**。新建的通用组件放进各端的原子组件库。

| 能力 | Web（`components/ui/`） | App（`src/components/UI.tsx` 等） |
| --- | --- | --- |
| 按钮 | `button` | `Button`（iOS 用 SwiftUI） |
| 列表 | `list-card`（`ListCard`、`ListRow`、`ListLoadMore`…）；参考实现 `components/decision/Watchlist.tsx` | `ListPage`（虚拟列表） |
| 分段 / 筛选 | `segmented-control`、`chip-button`、`filter-sheet` | `Chip`、`Filters` |
| 下拉选择 | `select`（Radix） | 原生 sheet |
| 弹窗 / 确认 | `dialog`、`sheet` | sheet、`ConfirmAction` |
| 加载 | `content-loading`（`ContentLoading`、`PendingValue`） | `LoadingStatus`、`PendingValue` |
| 说明气泡 | `info-tip` | 信息按钮 |
| 股票标识 | `stock-badge`、`company-logo` | `StockBadge`、`CompanyLogo` |
| 情绪 / 强度 | `sentiment-badge`、`weight-indicator` | `OpinionStrength` |
| 搜索 | `search-input` | `UI.Search`、原生搜索栏 |
| 玻璃材质 | `--card-glass` | `Glass`（iOS 26+ 用 SwiftUI Liquid Glass，只用于外框） |

**列表规则（Web）**：所有集合列表都是一个 `ListCard`。分区标题和数量 / 刷新 / 查看全部放在卡片外面上方；卡片内不再嵌套卡片，行不做成独立方框。

## 5. 状态

| 状态 | 规则 |
| --- | --- |
| 加载 | 300ms 内不显示任何东西；之后显示一个小转圈 + 一行文字。列表不画占位行；已知股票代码的行直接显示真实行，未到的数值用 `PendingValue`（和表示缺失的「—」区分开） |
| 后台刷新 | 已有内容保持显示，不闪回加载态 |
| 空 | 一句话 + 一个操作按钮 |
| 错误 | 说明发生了什么 + 重试按钮；保留用户已输入的内容 |
| 过期 | 保留旧数据时明确标注「已过期」或快照时间 |
| 进行中的操作 | 提交、AI 生成、翻译、同步要有明确的进度反馈 |

## 6. 文案规则

两端都适用（来自 `kolvex-frontend-web-nextjs/CLAUDE.md`）：

1. 标题下不要配一句复述标题的副标题。
2. 不要在每个模块下面加说明文字。
3. 免责声明和更新时间只在页脚出现一次。
4. 按钮文字直接写动作，不要写「点击按钮即可…」。
5. 空状态只写一句话，再给一个操作按钮。
6. 必要的解释放进 ⓘ 提示气泡，默认不显示。

另外：
- 观点强度用文字描述，不显示数字分数。
- 涨跌、方向用「看多 / 看空 / 中性」等明确文字，配合颜色和符号。
- 每段中文文案都要有对应英文；证券代码和美元金额保持市场写法。

## 7. 交互与无障碍

- **焦点**：Web 禁用了 ring 工具类。键盘焦点用 2px `primary` 外框 + 中性背景，不要给组件加 ring。
- **悬停**：深色模式下悬停只加浅中性填充，文字变为 `foreground`，不变成彩色。
- **动效**：克制。尊重「减少动态效果」；App 不做自定义动画。
- **深色模式透明度**：App 开启「降低透明度」时，玻璃材质换成不透明 token。
- **手机布局**：Web 每个页面都要在 390px 宽度下检查；宽表格要么可横向滚动并有提示，要么改成卡片。

## 8. Web `DESIGN.md` 章节表

改哪块界面就读哪一节（`grep -n '^## ' kolvex-frontend-web-nextjs/DESIGN.md` 可看行号）：

| 界面 | 章节 |
| --- | --- |
| 全局基础 | Overview · Colors · Typography · Layout · Elevation & Depth · Shapes · Components · Do's and Don'ts |
| 交互通用 | Interaction feedback · Focus without rings · Application-wide rounded geometry · Canonical list cards · Content loading states |
| 行情 | Market overview · Market activity lists · Macro indicators in Markets · Market display preference · Market event calendar · Markets overview refinement · Markets rounded surfaces |
| 个股 | Stock analysis history · Chart controls and result reading · Stock research reading · Stock workspace on phones · Stock valuation · Company valuation calculator · Quote and chart freshness |
| 观点 | Creator detail loading · X creator content · X opinion summary snapshots · Opinion feed background and motion · YouTube opinion initial loading |
| 日报 / 新闻 | Daily Briefs · Brief calendar · Three daily editions · Brief content language · Admin daily brief CRUD · Weekend brief reader · News terminal |
| AI 研究 | Shared AI result history · AI Research grouped task library |
| 虚拟交易 | Virtual trading workspace · Virtual trading after-hours valuation |
| 公开页 / 落地页 | Marketing landing page · Public research reading · Public landing page · Public and workspace presentation parity |
| 导航 | Floating mobile navigation |
| 数据 | Client data caching · Portfolio visibility |
