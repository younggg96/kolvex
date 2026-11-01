# 股价折线图重做：时间跨度 + 简洁风格

2026-11-01。用户反馈（原文）：

> 折线图中也还是要对应的一些简单操作，时间跨度还是需要保留 设计风格要像图二学习

参考图：

- `../price-chart-seriea-style-reference.webp` —— 改造前的样子（图一）：2.5px 单一橙色粗线、无填充、
  带边框的坐标轴、6 个以上拥挤的日期标签、图下一条观点图例。
- `../price-chart-finsepa-style-reference.webp` —— 目标风格（图二）：近黑底、无左边轴、无边框的安静曲线，
  线下渐变面积、开盘价虚线基准、右侧小号价格数字、峰值处一枚浮动标签、最新价一个填充胶囊、3–4 个日期标签。

## 做了什么

| 区域 | 变化 |
| --- | --- |
| 组件 | 新增共享组件 `components/youtube/chart/PriceGraph.tsx`；紧凑预览与全屏图表都渲染它；`ChartView` 不再自己画预览 |
| 时间跨度 | 图内自带范围条：1日 / 1周 / 1月 / 3月 / 6月 / 年初至今 / 1年 / 5年 / 全部 / 自定义；**真正按所选区间取数据**（此前不论显示哪个区间都只拉 yfinance 的 `3mo`） |
| 操作 | ⌘/Ctrl + 滚轮与双指缩放（最少 8 根）、水平拖动平移、双击/双击触控复位、仅在视图被改过时出现“重设缩放”；悬停或触摸时虚线游标 + 圆点 + 日期价格胶囊 |
| 样式 | 绿/红按所选区间的涨跌着色，线下渐变面积，无左边轴无边框，右侧高/低/最新价标签，稀疏日期标签，峰值浮动标签，开盘价虚线 |
| 标记 | 博主观点仍是柱上下三角（▲ 看涨 / ▼ 看跌 / · 中性，同日多条显示数量） |
| 积分 | 手机端范围条与图标行上下分行，长标签不再遮住按钮 |
| 无障碍 | 紧凑视图 `role="img"` + 价格涨跌描述，全屏 `role="slider"` + 方向键逐日查看，范围条 `radiogroup`/`radio`，44px 触控目标，`prefers-reduced-motion` 下取消范围切换的淡入淡出 |
| 老图表 | 全屏图同样使用新的范围条与 `ChartView` 外观，新增 6M 区间；蜡烛、指标、副图指标、画线共用同一可见窗口与坐标 |

## 验证

- `node_modules/.bin/tsc --noEmit -p .`：0 错误（改造前基线也是 0）。
- `node --test scripts/*.test.cjs`：300 项，289 通过；11 项失败与本次改动无关，且在改造前的干净工作区里
  以完全相同的方式失败（`git stash` 对照已确认）：creator-share-ui、loading-states、public-reading、
  reddit-opinions 四组旧测试缺少 `useSearchParams` 等 mock。
- 新增测试：`scripts/chart-range.test.cjs`（区间→yfinance 参数）、`scripts/chart-timeframes.test.cjs`
  （6M）、`scripts/chart-graph-helpers.test.cjs`（视图/缩放/日期刻度/价格域）、
  `scripts/chart-view-integration.test.cjs`（ChartView→PriceGraph 的接线）。
- `next build` 通过。
- 真实数据走查：用本机 Next 服务与后端行情接口，把 `PriceGraph` 以 3月/6月/1年/1月 渲染到无头 Chromium，
  每个区间都取到对应长度的历史并重绘。

截图：`preview-3M-dark.png`（桌面，真实 NVDA 3月数据）、`mobile-controls.png`（手机，范围条与图标分行）。

## 相关代码

- `kolvex-frontend-web-nextjs/components/youtube/chart/PriceGraph.tsx` —— 图表本体（几何、范围条、交互、绘制）
- `kolvex-frontend-web-nextjs/components/youtube/chart/ChartMarkers.tsx` —— 观点三角、峰值标签、价格胶囊
- `kolvex-frontend-web-nextjs/lib/chart/graph.ts` —— 视图/缩放/刻度/价格域等纯函数
- `kolvex-frontend-web-nextjs/lib/chart/range.ts` —— 区间 → 行情参数、默认区间、区间标签
- `kolvex-frontend-web-nextjs/components/youtube/PriceChart.tsx` —— 区间状态与取数、自定义日期选择
- `kolvex-frontend-web-nextjs/components/youtube/chart/ChartView.tsx` —— 全屏图表、画线、AI 面板
