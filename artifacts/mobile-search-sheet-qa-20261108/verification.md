# Mobile search — dock-expanded search bar (2026-11-08)

## 变更（只改 mobile）

- 探索页不再在顶部显示「探索」大标题和输入框。输入框移进底部 Dock：进入探索页后 Dock 展开成搜索栏（搜索框 + 取消），
  键盘弹出时 Dock 位于键盘上方，并自动聚焦、可直接输入。
- 「最近搜索」紧贴在搜索栏上方，同一 Dock 内横向滚动。
- 其余内容从下往上排列：最近搜索 → YouTube 博主热议 → YouTube 热门博主 → Reddit 讨论最热 → X 创作者 → 最新研究 → 最新新闻 → 最新日报；
  上方多余空间留白（`justifyContent: space-between`），最新区块贴近 Dock。
- 搜索状态：筛选 chip 位于最上方，结果分组仍从下往上（股票 → 创作者 → AI 研究），空态/加载/部分失败提示同理。
- Dock 展开态底栏只有「返回」和菜单；「返回」先清空查询，再离开探索页。

设计取舍：最近搜索在页内按旧版做成逐行列表会占 6×44pt，把最新内容挤出首屏，与“从下往上排列”冲突，
因此页内改为紧凑 chip 单行（带「清除」），最近搜索的完整列表不再占首屏。

## 改动文件

- `kolvex-mobile/src/app/(tabs)/search.tsx`：布局重排、移除顶部标题/输入框、最近搜索 chip 行、下上排列。
- `kolvex-mobile/src/components/Dock.tsx`：Dock 展开成搜索栏（`useDockSearch` 槽位 + 纯函数 `publish`），
  web 预览下用 `visualViewport` 把 Dock 抬到软键盘上方。
- `kolvex-mobile/src/components/search/SearchSections.tsx`（新）：SearchGroup / PillRow / Pill / ResultRow。
- `kolvex-mobile/src/lib/useSearchHistory.ts`（新）：账号维度的最近搜索状态。
- `kolvex-mobile/translations/native-en.json` + `src/lib/uiMessages.json`：新增「YouTube 热门博主」英文条目。

## 验证方式

本机没有运行后端，登录态也无法在 Web 预览中持久化，所以用 Playwright + Chromium 在 390×844 下：
通过伪装 auth 接口完成登录、拦截 `/api/v1/**` 返回固定示例数据（无真实账户、无写操作），再操作页面并截图。

## 结果

| 场景 | 期望 | 实际 |
| --- | --- | --- |
| 进入探索页 | 无「探索」标题与顶部输入框；Dock 展开为搜索栏 | 通过 |
| 最近搜索 | 位于搜索栏正上方 | 通过（Dock 内一行 chips） |
| 内容排列 | 从下往上，最新区块贴近 Dock | 通过（见 after-bottom-first.png） |
| 软键盘弹出（模拟 `visualViewport` 高度缩短） | Dock 抬到键盘上方 | 通过（输入框底边 464 < 可见视口底 524，见 after-keyboard-lift.png） |
| 输入查询 | 筛选 chip 在最上，结果组从下往上 | 通过 |
| 从行情点 Dock「探索」 | 进入探索页并展开搜索栏 | 通过 |
| 普通 Tab 页面 | Dock 仍是四个按钮 | 通过（搜索槽位只在探索页聚焦时持有） |

## 静态检查

- `./node_modules/.bin/tsc --noEmit`：通过。
- `npx expo lint`：无 error / warning。
- `node --test`：73 通过、2 失败（`freeResearch.ts`、`opinionDates.ts` 的 Web 源码同步测试）。
  这两个失败在未改动的 HEAD 上同样失败，原因是工作区里 Web 端文件已被其它改动修改，与本次改动无关。
- `node scripts/generate-ui-messages.cjs --check`：通过。

## 未验证

- iOS / Android 真机：键盘避让（iOS 由 `automaticallyAdjustKeyboardInsets`，Android 由系统 resize）、
  Dock 玻璃材质下的搜索栏外观、液态玻璃返回键布局。
- 中文输入法组合输入（IME）过程中的搜索刷新。
