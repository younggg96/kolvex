# Kolvex Web → iOS RN 移植工作指引（teammate 必读）

Repo 根目录：`/Users/guanggengyang/Documents/GitHub/kolvex`
- App：`kolvex-mobile`（Expo SDK 58 / RN 0.88 / React 19 + React Compiler）
- Web 唯一参考：`kolvex-frontend-web-nextjs`（Next.js）

## 目标

把你负责的 App 页面做到与 **Web 端手机宽度（<640px）** 的布局、尺寸、文案、交互 **1:1 一致**。只对照深色模式。组件一律用 iOS 原生 Liquid Glass（`Glass` 已封装好）。

## 尺寸规则（必须遵守）

Web 在手机上把 html 字号设为 14px，所以 1rem = 14px，桌面 Tailwind 的 px 全部 ×0.875。

- 统一用 `src/components/UI.tsx` 的 `phone(px)`（内部 ×0.875）。文字用 `Copy` 组件（自动缩放、最小 11px）。
- `Copy` 的 `size` 传的是**桌面 px**（内部自动缩放）：text-xs=12、text-sm=14、text-base=16、text-lg=18、text-xl=20、text-2xl=24。渲染结果 ≈ 11 / 12.25 / 14 / 15.75 / 17.5 / 21px。
- 卡片：`rounded-3xl`（`Glass` 已内置 24px 圆角）；`p-3`=12、`p-4`=16、`p-5`=20；`gap-2`=8、`gap-3`=12、`gap-4`=16。
  **重要**：`Glass` 会自动把 `style` 里的 padding/gap 等间距 ×0.875（见 `scaleSpacing`），所以 `Glass style={{ padding: 12 }}` 对应 Web `p-3`，直接写桌面 px 即可。裸 `View` 没有自动缩放，要用 `phone(px)` 显式换算。
- 分段控件：md = min-h-10(40px)、text-sm；sm = min-h-8(32px)、13px。用 `Chip`/`Filters` 已内置。
- 输入框字号保持 **16px**（防 iOS 自动放大）。
- 按钮 `Button`/`Chip` 已内置尺寸，不要自己写 padding 覆盖它们。
- **先读对应的 Web 组件，按其中 `max-md:` / `sm:` class 换算**（手机宽度取 `max-md` 分支），不要凭感觉。Tailwind 类：`p-3`=12px、`p-4`=16px、`gap-3`=12px、`text-sm`=14px 桌面、`min-h-10`=40px 桌面 等，全部换算成上面 `Copy size` / `Glass style` 的桌面 px。

## i18n 规则

- 界面中文文案写成字面量（不要 `c()`）。
- 英文翻译加到：
  - `translations/native-en.json`（整句，key=中文、value=英文）
  - `translations/templates-en.json`（带 `{0}` 占位符的模板句）
- 英文优先从 Web 的 `c("en","zh")` 或 `lib/i18n/locales/en.json` / `zh.json` 里取。
- 加完运行 `npm run i18n:generate`。
- `native-en.json` 已有约 12 万字符的词典，**绝大多数中文句已存在**，只有真正新增的才需要加。若编辑共享 JSON 文件报 `FS_STALE_VERSION`，重新 `read` 该文件后基于新内容重试。

## 每次改完都要跑（顺序）

```bash
cd kolvex-mobile
npx tsc --noEmit
npx expo lint
npm run i18n:check
npm test        # 必须 79 个测试全过
```

## 硬性约束

- **native-text-contract 测试**：非 `Text`/`Copy` 组件下面不能直接放裸字符串；可选内容用 `!!x && <Copy>…</Copy>`。
- **React Compiler lint**：不要在 effect 里同步调用 setState（可用 `setTimeout` 或 `useEffectEvent`）。
- **Hermes 不支持 `signDisplay`**：正负号要手写。
- **不要触发任何模型调用**：不点「更新 AI 研究」、不发聊天消息。
- **不要输入任何真实账号密码。**
- **不要 commit。**
- 深色模式优先；每改完一页，用 `xcrun simctl io booted screenshot <file>` 截图，和 Web 手机布局对比（deep link 见下）。

## 验证用 deep link

```bash
xcrun simctl openurl booted "kolvex://stock/NVDA?tab=creators"
xcrun simctl openurl booted "kolvex://settings?tab=api-keys"
xcrun simctl openurl booted "kolvex://chat?history=1"
xcrun simctl io booted screenshot /tmp/check.png
```

路由都在 `src/app/`，入口在 Dock 菜单。每个页面文件都很薄，主要布局在其 `src/components/*` 里对应组件。改完一个页面就截图对比一次再继续。

## 完成报告格式

报告：改了哪些文件、每个页面与 Web 的哪几个尺寸差异已修正、新增了哪些 i18n 键、4 项检查是否全过（贴 exit code）。不要 commit。
