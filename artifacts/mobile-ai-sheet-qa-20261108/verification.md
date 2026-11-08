# Mobile AI sheet — single-sheet QA (2026-11-08)

## 变更

手机端高级图表（`ChartView mode="advanced"`）里，“AI 图表操作”底部 sheet 的“AI 设置”不再叠加第二个
`layout="sheet"` 对话框，而是同一个 sheet 内切换步骤：

- 操作步骤：AI 分析 / AI 画线 / 设置图标。
- 设置步骤：返回箭头 + “AI 设置”标题 + 模型、分析内容、画线内容、画线版本 + 关闭/开始底部栏。
- 未选模型时直接点“AI 分析 / AI 画线”，sheet 切到设置步骤（不再在 sheet 之上再开 sheet）。
- 设置步骤按 Esc / 返回箭头回到操作步骤；按 × 关闭整个 sheet。
- 桌面端（lg+）侧栏的“AI 设置”仍是独立居中对话框，未改变。

改动文件：`kolvex-frontend-web-nextjs/components/youtube/chart/ChartView.tsx`

## 验证方式

用临时路由（`app/tmp-ai-sheet`，验证后已删除）渲染真实的 `ChartView mode="advanced"` +
真实 `TechnicalFocusSelector` / Dialog 基础组件，仅数据（K 线、AI 任务、模型供应商）为桩数据；
用 Playwright + 本地 Chromium 在 390×844（手机）和 1280×900（桌面）下操作并截图。

## 结果

| 场景 | 期望 | 实际 |
| --- | --- | --- |
| 手机打开“AI 图表操作” | 1 个 dialog | 1 |
| 点设置图标 | 仍在同一个 dialog 内，共 1 个 | 1（标题切换为“AI 设置”） |
| 设置步骤点返回 | 回到操作步骤，dialog 仍为 1 个 | 1（标题“AI 图表操作”） |
| 设置步骤按 Esc | 回到操作步骤，不关闭 sheet | 1（标题“AI 图表操作”） |
| 未选模型点“AI 分析” | 同一 sheet 切到设置步骤 | 1（标题“AI 设置”，底部出现“开始分析/取消”） |
| 桌面侧栏点“AI 设置” | 打开居中对话框 | 1 |
| 桌面对话框“关闭”/“取消”/Esc | 关闭对话框 | 0 |

控制台无 warning / error（除桩数据导致的 401 资源请求）。

截图：`actions-step.png`、`settings-step.png`、`pending-run-step.png`、`desktop-dialog.png`。

## 静态检查

- `./node_modules/.bin/tsc --noEmit`：通过。
- `./node_modules/.bin/next lint --file components/youtube/chart/ChartView.tsx`：无 warning / error。
- `node --test scripts/chart-view-integration.test.cjs`：11/12 通过；`creator-opinion charts can hide AI
  surfaces in compact and advanced modes` 在本次改动前（HEAD d129a1d）即失败，与本次改动无关。
