# 博主新动态 UI 对齐自选股 — 2026-11-02

## 目标

「博主新动态」卡片与「自选股」卡片在视觉和尺寸上保持一致（list item 大小等）。

## 范围

只改 `kolvex-frontend-web-nextjs/components/decision/Market.tsx` 中 Market overview 右侧
aside 的 Creator updates 区块。`MarketWatchlistCard.tsx` 未改动 —— 它是基准。

（本仓库的移动端 `kolvex-mobile` 没有这两个卡片，截图对应的是 Web 响应式视图。）

## 改动

| 项目 | 之前 | 之后 |
|---|---|---|
| 容器 | `Panel surface="card"`（表头在卡片外，`text-xl`，再被 `[&>header_h2]:text-lg` 覆盖） | 与自选股相同的手写 `section` + `header`，`text-lg font-semibold` |
| 标题行高度 | 自适应 | `min-h-14`（56px） |
| 标题行动作 | 文字链「全部观点 ↗」 | `Button ghost icon` 44×44 的 ↗ 图标，与自选股的刷新/跳转按钮同款 |
| 数量胶囊 | 无 | `6/6` 风格的 `rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums` |
| 卡片 | `Card p-3 sm:p-4` | `ListCard`（规范外壳，`p-3 sm:p-4`） |
| 行高 | `min-h-20`（80px）+ `py-4` | `min-h-11`（44px），与自选股行一致 |
| 行布局 | `flex justify-between gap-3 px-1 py-4 rounded-2xl` | `grid grid-cols-[minmax(0,1fr)_auto] gap-2 px-1 rounded-full` |
| Logo | `size="sm"`（32px） | `size="xs"`（20px） |
| 骨架 | `space-y-4 h-12` | `space-y-3 h-11`，并加 `role="status"` |
| 空/错误 | `Empty` 组件 | 与自选股空态同款的居中 `px-3 py-6` 区块 |
| 页脚 | 不变 | 不变（`ListFooterLink`） |

右侧两行倾向/变化（`OpinionStrength`）保留 —— 这是该卡片本身的信息；只是整体被压进
44px 行内，视觉节奏与自选股的价格/涨跌两列一致。

## 验证

用 Playwright 渲染真实组件（仅把两个数据 hook 换成固定数据），在 393 / 768 / 1440 三个宽度量测：

```
=== width 1440 ===
  watch    BEFORE header=56 card=320x590 pad=[16px] rows=[44,44,44,44,44,44] target=278x44 logo=20x20 footerH=44
  watch    AFTER  header=56 card=320x590 pad=[16px] rows=[44,44,44,44,44,44] target=278x44 logo=20x20 footerH=44
  creator  BEFORE header=56 card=320x486 pad=[16px] rows=[80,80,80,80,80] target=278x80 logo=32x32 footerH=44
  creator  AFTER  header=56 card=320x306 pad=[16px] rows=[44,44,44,44,44] target=278x44 logo=20x20 footerH=44
```

393 与 768 宽度结论相同（行高 80→44，logo 32→20，均与自选股完全一致，无横向溢出）。

行的计算样式（1440）：

```
watch   row h=44 gap=8px pad=0px 4px radius=9999px align=center
creator row h=44 gap=8px pad=0px 4px radius=9999px align=center   ← 与自选股一致（改前 gap=12px pad=16px 4px radius=16px）
```

| 检查 | 结果 |
|---|---|
| `tsc --noEmit` | 通过 |
| `next lint --file components/decision/Market.tsx` | 无警告、无错误 |
| 决策/行情/自选/博主相关测试 | 全部通过（decision-regressions、opinion-empty-states、market-quotes、watchlist、market-index-routes、stock-discovery、youtube-dashboard-cache、creator-share） |
| 全量测试 | 37 通过 / 4 失败 |
| 全量测试（回滚本改动后） | 同样 4 个失败，均在未改动的文件中，属既有问题 |
| loading / empty / error 三态 | 已截图检查（creator-*.png） |
| 移动端 393、平板 768、桌面 1440 | 无横向溢出 |

## 局限

Market 页需要登录，本地没有 `.env.local` 与 Supabase 会话，因此**未能**在真实登录态下
做端到端浏览器验证。上面用真实组件 + 固定数据渲染；数据 hook（`useWatchlist`、
`useCreatorCatalogue`、`loadMarketQuotes`）被替换，其余组件均为真实代码。自选股行的
报价列因此显示为骨架占位，未伪造价格。

---

# 第二轮：右侧两行标签改为横排 — 2026-11-02

## 问题

`博主新动态` 每行右侧是两行 12px 粗体标签（倾向 + 变化），塞在 44px 行内：

- 两行行高各 16px，`gap-1` 只有 4px 缝隙
- 逐行右对齐 + 每行宽度不同（102.7 / 121.7 / 139.4px），左边缘参差不齐
- 英文下 `Mildly strengthening` 单行就 139px，整块非常拥挤

## 为什么是「箭头」而不是「两行文字横排」

在桌面 320px 侧栏（内宽 286px）实测：

| 方案 | 中文右列宽 | 英文右列宽 | 结果 |
|---|---|---|---|
| 两行文字全部横排 | 167px | **250px** | 英文下 ticker 列被压到 **0px**（布局塌陷） |
| 11px 两行横排 | 166px | **263px** | 同上，仍塌陷 |
| 方向词 + 趋势条 + 箭头 | 110–127px | 128–184px | ticker 列保留 107–128px，安全 |

结论：英文两行全文字无法横排进该宽度，属硬约束。

## 改动

- `components/youtube/StrengthIndicator.tsx`：新增 `barsOnly` 选项 — 只渲染等级条 + 方向箭头（↑/↓），文字通过 `sr-only` 保留给读屏。默认 `barsOnly={false}`，原有渲染路径不变。
- `components/youtube/OpinionStrength.tsx`：透传 `barsOnly`。
- `components/decision/Market.tsx`：右侧由 `flex-col items-end gap-1.5` 改为
  `flex items-center gap-1.5 whitespace-nowrap`，两段之间加 1px 竖直分隔线。

「转强/转弱」由箭头方向 + 趋势条等级表达（与左侧「看涨/看跌」使用同一套等级条语义）。
「首次覆盖」保持文字。

## 验证

| 断点 | 自选股 | 博主新动态 |
|---|---|---|
| 393px | header=56 card=345 rows=44 pad=12 | header=56 card=345 rows=44 pad=12 |
| 768px | header=56 card=720 rows=44 pad=16 | header=56 card=720 rows=44 pad=16 |
| 1440px | header=56 card=320 rows=44 pad=16 | header=56 card=320 rows=44 pad=16 |

三档均无横向溢出。中文/英文、浅色/深色、移动端均已截图。

右侧列宽（1440，中文）：NOK/NKE/SOXL/RDDT = 114px，HPQ（首次覆盖）= 132px；
ticker 列保留 130–148px，不再塌陷。

| 检查 | 结果 |
|---|---|
| `tsc --noEmit` | 通过 |
| `next lint`（三个改动文件） | 无警告、无错误 |
| decision / market / watchlist / creator / stock-discovery 测试 | 全部通过 |
| `public-reading.test.cjs` | 2 个失败，**回滚改动后同样失败**（`published` vs `public` 后端路径，与本次无关） |
| 公开阅读页（也使用 StrengthIndicator） | 未受影响的默认分支，未传 `barsOnly` |

截图：`fixed-zh.png`、`fixed-dark-1440.png`、`fixed-mobile-393.png`。

## 局限

同上：Market 页需登录，本地无 `.env.local`，未做登录态端到端验证。截图为真实组件 + 固定数据渲染。
