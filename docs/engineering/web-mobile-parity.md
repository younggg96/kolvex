# Web ↔ App 移植规范

> Web（`kolvex-frontend-web-nextjs`）和 App（`kolvex-mobile`）之间移植功能、保持一致的规则。
> 相关文档：`kolvex-mobile/MIGRATION.md`（逐功能移植台账）、`kolvex-mobile/.agents/PORTING.md`（逐页对照的操作手册）、`kolvex-mobile/VERIFICATION.md`（验证记录）。

## 1. 基本原则

1. **Web 是参考实现**。功能行为、文案、计算口径、字段以 Web 为准。App 对照的是 **Web 在手机宽度（< 640px）下的样子**，不是桌面版。
2. **同一个后端**。两端调用同一组 `/api/v1` 接口，不为 App 单独开一套业务接口。App 需要的数据 Web 也拿得到。
3. **行为一致，形态原生**。用户能做的事、看到的数据、规则必须一致；控件形态用平台原生的（见 §4 允许的差异）。
4. **差异要登记**。任何「App 有 Web 没有」或「Web 有 App 没有」都要写进 `MIGRATION.md` 的 *Missing or different* 列，不允许悄悄不同。
5. **新功能先 Web 后 App**（或同时做）。App 先做的功能，要在 `MIGRATION.md` 登记，并在汇报里说明需要 Web 补齐。

## 2. 必须完全一致的共享层

这些内容两端必须一致，大部分已有测试守住。改了 Web 这一侧，**同一个改动里**同步 App，否则 App 测试会失败：

| 共享内容 | Web 源文件 | App 对应 | 守护测试 |
| --- | --- | --- | --- |
| 功能开关 | `lib/productFeatures.ts` | `src/lib/productFeatures.ts` | `tests/web-source-parity.test.ts` |
| 颜色 token（浅色 / 深色） | `app/globals.css` | `src/lib/palette.ts` | `tests/theme-parity.test.ts` |
| AI 模型目录 | `lib/aiModels.ts` | `src/lib/aiModels.ts` | `web-source-parity` |
| 行情范围 / 基准 / 对比 | `lib/marketBenchmarks.ts`、`lib/marketComparison.ts` 等 | `src/lib/` 同名文件 | `web-source-parity` |
| 技术指标公式 | `lib/chart/` | `src/lib/` 图表相关文件 | `web-source-parity` |
| 数字 / 日期格式化 | Web 对应 lib | `src/lib/` 同名文件 | `web-source-parity` |
| 文中股票代码识别 | `lib/markdown/` | `src/lib/stockMentions.ts`（逐字复制） | `web-source-parity` |
| 免费研究 | `lib/freeResearch.ts` | `src/lib/freeResearch.ts` | `tests/free-research.test.ts` |
| 英文文案 | `useCopy` 的英文 / `lib/i18n/locales/en.json` | `translations/native-en.json`、`templates-en.json` | `npm run i18n:check` |
| 深链接路径 | Web 路由 | `src/app/+native-intent.ts`、`src/lib/deepLinks.ts` | — |

规则：
- 纯计算逻辑从 Web **逐字复制**到 App 的 `src/lib/` 同名文件，不要改写。需要改逻辑时先改 Web，再复制。
- 新增一类共享逻辑时，在 `tests/web-source-parity.test.ts` 加对照断言。

## 3. 尺寸换算（Web 手机宽度 → App）

Web 在手机上把根字号设为 14px，所以 **1rem = 14px**，Tailwind 的所有桌面 px 都要 **× 0.875**。

| Web（Tailwind） | 桌面 px | App 写法 |
| --- | --- | --- |
| `text-xs` / `sm` / `base` / `lg` / `xl` / `2xl` | 12 / 14 / 16 / 18 / 20 / 24 | `<Copy size={12…24}>`（传桌面 px，内部自动 ×0.875，最小 11px） |
| `p-3` / `p-4` / `p-5` | 12 / 16 / 20 | `Glass style={{ padding: 12 }}`（`Glass` 会自动缩放间距） |
| `gap-2` / `gap-3` / `gap-4` | 8 / 12 / 16 | `Glass` 内直接写桌面 px；裸 `View` 用 `phone(px)` |
| `rounded-3xl` 卡片 | 24 | `Glass` 已内置 |
| 分段控件 md / sm | 高 40 / 32 | `Chip` / `Filters` 已内置 |
| 输入框字号 | — | 固定 **16px**（防止 iOS 自动放大） |

- **先读 Web 组件里 `max-md:` / `sm:` 分支的 class**，按手机分支换算，不要凭感觉。
- `Button` / `Chip` 已内置尺寸，不要自己写 padding 覆盖。
- 可点区域至少 44pt。

## 4. 组件对照与允许的差异

| Web | App | 说明 |
| --- | --- | --- |
| 左侧边栏 / 手机抽屉 | iOS `NativeTabs`（5 个 tab）+ More 宫格；Android/Web 用 `Dock` | 导航结构见 `kolvex-mobile/DESIGN.md` |
| URL 查询参数（`?tab=`、`?view=`） | 路由参数 + 深链接，`?tab=` 保持同名 | 例：`kolvex://stock/NVDA?tab=creators` |
| `components/ui/button` | `UI.Button`（iOS 用 SwiftUI 按钮） | |
| `Card` / `ListCard` | 不透明卡片；`Glass` 只用于搜索栏、操作栏等「外框」 | 数据卡片不放在玻璃材质上 |
| `SegmentedControl` | `Chip` / `Filters` | |
| Radix `Select` / `DropdownMenu` | 原生 sheet / 选项列表 | |
| Radix `Dialog` | sheet；永久删除、管理员操作用 `ConfirmAction` | |
| 宽表格 `table` | 卡片列表，或「固定标签列 + 横向滚动」 | 必须在 MIGRATION 登记 |
| hover 查看数据点 | 点击选中数据点 | |
| 拖拽画线 | 拖动放置 + 表单精确输入（无障碍备选） | |
| `ContentLoading` | `LoadingStatus`（300ms 后显示文字，不用骨架块） | |
| `InfoTip`（ⓘ 气泡） | 信息按钮 | |
| toast / inline live region | 行内状态（`MutationStatus`） | |
| SSE 进度流 | 轮询 `progress_events` | 允许的差异 |
| 复制按钮 | 系统分享面板（自带复制） | |
| 未登录公开页（`/stocks`、`/creators`、`/research`） | **不提供**：App 必须登录，分享链接引导到登录页 | 产品决定 |

**不允许的差异**：数据字段缺失或口径不同、文案含义不同、权限不同（例如 App 对非管理员显示管理入口）、Web 关闭的功能在 App 打开。

## 5. App 端硬约束

- **Expo 版本**：写任何 Expo / RN API 前，按 `kolvex-mobile/AGENTS.md` 查 SDK 58 对应版本的文档，不要凭记忆。
- **裸字符串**：非 `Text` / `Copy` 组件下不能直接放字符串（`native-text-contract` 测试）。可选内容写成 `!!x && <Copy>…</Copy>`。
- **React Compiler**：不要在 effect 里同步 `setState`（可用 `setTimeout` 或 `useEffectEvent`）。
- **Hermes**：不支持 `Intl.NumberFormat` 的 `signDisplay`，正负号手写。
- **玻璃材质**：只用于外框和系统控件；开启「降低透明度」时用不透明 token。
- **文案**：中文写字面量（不要包 `c()`），英文加到 `translations/`，优先从 Web 现有英文复制，加完跑 `npm run i18n:generate`。
- **账户隔离**：切换账户时重新挂载账户范围的组件，丢弃上一个账户迟到的响应。私有数据不进共享缓存。

## 6. 移植一个 Web 功能到 App：检查清单

1. 在 `MIGRATION.md` 找到该功能的行（没有就新增），确认 Web 入口、组件和 `productFeatures` 状态。
2. 读 Web 实现：页面 → 组件 → `lib/` → `app/api/` 代理 → 后端路由。列出所有字段、状态（加载 / 空 / 错误 / 过期）、权限、文案。
3. 共享逻辑从 Web `lib/` 逐字复制到 `src/lib/`，必要时在 parity 测试里加断言。
4. 写路由（`src/app/`，保持薄）和组件（`src/components/`），按 §3 换算尺寸，按 §4 对照组件。
5. 在 `+native-intent.ts` 加上 Web 路径到 App 页面的深链接映射。
6. 补齐英文文案，跑 `npm run i18n:generate`。
7. 跑检查：`npx tsc --noEmit && npx expo lint && npm run i18n:check && npm test`。
8. 在 iOS 模拟器深色模式下截图，和 Web 390px 宽度对比，修正尺寸差异。
9. 更新 `MIGRATION.md` 该行：*Implemented*、*Missing or different*、*Verified to*（按 §8 的等级如实填写）。

## 7. 修改一个已移植的功能：同步义务

改 Web 的已移植功能时，必须在汇报里说明 App 是否跟进：

| Web 改动类型 | App 要做的 |
| --- | --- |
| 共享层（§2 表格中的文件） | **同一个改动里**同步，否则 App 测试失败 |
| 后端接口字段 / 语义变化 | 同一个改动里同步 App 的 API 客户端，或保持接口向后兼容 |
| 新增用户可见的能力 | 同步实现，或在 `MIGRATION.md` 登记为待移植 |
| 纯视觉调整 | 评估是否适用于原生形态；不适用就在汇报里说明原因 |
| 功能下线（`enabled: false` 或退役） | App 同步隐藏入口和深链接，`MIGRATION.md` 移到「Disabled on the Web」 |

反方向（App 先做、Web 没有）同理：在 `MIGRATION.md` 登记，并告诉用户 Web 需要补齐。

## 8. 验证等级

`MIGRATION.md` 的 *Verified to* 列只能填实际达到的等级，不能高报：

| 等级 | 含义 |
| --- | --- |
| **C** Code | 已实现，类型检查、lint、单元 / 契约测试通过 |
| **B** Bundle | 已包含在 Metro / Hermes 的 iOS、Android 导出产物里（不是原生编译） |
| **W** RN-Web | 在 390px 的 RN Web 预览里用真实后端数据看过主要读取路径（不能代替原生） |
| **Native** | 在 iOS / Android 模拟器或真机上运行过 |
| **Business** | 登录后的真实读写流程端到端跑通 |
| `Auth` | 需要登录，成功路径没有跑过 |
