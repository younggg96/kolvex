# 视频观点卡 hover UI 修复 — 2026-11-02

## 问题

`components/youtube/VideoOpinionCard.tsx` 中观点行的 hover 底色块有问题，
截图对应 `compact` 分支（移动端/窄屏，2 行折叠）。

实测（393px 宽）：

```
改前 compact: padding = "12px 0px", border-radius = 16px
改前 desktop: padding = "12px",    border-radius = 9999px, margin = "0 -12px"
```

`compact` 分支继承了 `rounded-2xl`（16px 圆角）却**丢掉了水平内边距**
（`px` 只在 `!compact` 的 `sm:px-3` 里出现），于是：

1. 文字直接贴着色块左右边缘，首字被圆角弧线压迫
2. 色块顶部圆角吃掉相邻 `border-t` 分隔线的两端，线在两侧"断开"
3. 色块底边与下方文字之间没有呼吸

桌面端（非 compact）本来是对的，问题只出在 compact 分支。

## 改动

`VideoOpinionCard.tsx`，两处：

```diff
- <li key={opinion.id} className="border-t border-border first:border-t-0">
+ <li key={opinion.id} className="border-t border-border first:border-t-0 has-[button:hover]:border-transparent has-[button:focus-visible]:border-transparent">
```

```diff
- ... rounded-2xl py-3 ...
+ ... rounded-2xl px-3 py-3 ...
```

- `px-3`：补齐水平内边距，文字与圆角之间留出 12px
- `has-[...]`：hover / 键盘聚焦时把该行的分隔线设为透明，避免圆角与分隔线交叠产生的脏边。
  这也是纯 CSS，无 JS 状态。

## 验证

| 宽度 | 横向溢出 | 按钮 padding | hover 行分隔线 |
|---|---|---|---|
| 320px | 无 | 12px | 透明 |
| 360px | 无 | 12px | 透明 |
| 393px | 无 | 12px | 透明 |

桌面端（非 compact）回归检查，未受影响：

| 宽度 | 横向溢出 | padding | radius | margin |
|---|---|---|---|---|
| 1440px | 无 | 12px | 9999px | 0 -12px |
| 768px | 无 | 12px | 9999px | 0 -12px |
| 640px | 无 | 12px | 9999px | 0 -12px |
| 480px | 无 | 12px | 0 | 0 |

`tsc --noEmit` 通过；`next lint` 无警告无错误。
youtube-dashboard-cache / opinion-empty-states / decision-regressions /
youtube-video-history / creator-share 测试全部通过。

## 尝试过但放弃的方案

给按钮加 `-mx-3` 让色块横向外扩盖住分隔线 —— 实测会在 320/360/393px 全部产生
横向溢出（按钮右边 = 397px > 视口），已回退。

## 局限

未登录态，Market/观点页需登录；截图为真实组件 + 固定数据渲染（仅 stub 掉
`next/link`、`next/image`、`next/navigation`）。hover 态由 Playwright 真实指针悬停触发。
