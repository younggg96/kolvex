# Kolvex Mobile

独立的 React Native / Expo 手机客户端，中文优先。首版提供公开行情、YouTube 创作者观点、股票历史收盘价及本机自选；账户、Plaid 和 AI 功能尚未迁移。

## 启动

需要 Node.js 22.13+。

```sh
cd kolvex-mobile
npm ci
npm start
```

使用支持 SDK 58 的 Expo Go 扫码，或安装 development build。原生依赖与 Expo Go 版本必须匹配；本机 iOS 模拟器需要完整 Xcode，Android 需要 Android Studio / SDK。

```sh
npm run ios
npm run android
npm run web
```

`web` 是 React Native Web 预览，不展示原生 Liquid Glass。

## 数据

不配置环境变量时，展示明确标记的静态演示行情；不编造创作者观点。股票历史演示曲线仅用于验证界面，不能用于研究。

复制 `.env.example` 为 `.env` 并配置完整 API 前缀：

```dotenv
EXPO_PUBLIC_API_URL=https://your-api-host/api/v1
```

本机 FastAPI 默认端口为 8080。iOS 模拟器可使用 `http://127.0.0.1:8080/api/v1`；Android 模拟器使用 `http://10.0.2.2:8080/api/v1`；真机使用开发机器的局域网 IP，后端监听 `0.0.0.0`。HTTP 访问受 iOS ATS / Android 网络策略限制，必要时使用受信 HTTPS 开发隧道。生产使用 HTTPS。环境变量修改后重新启动 Metro。Web 预览须在后端 CORS 配置预览站点来源。

客户端直连后端 `/market/quote/{symbol}`、`/market/history/{symbol}`、`/youtube-opinions/dashboard`，不依赖 Next.js 代理。请求在切换或卸载时取消，超时 15 秒；真实接口失败会明确报错，不回退演示值。自选仅存储于设备 AsyncStorage，不与网页账户同步。

## 原生玻璃

- 原生底部导航使用 Expo Router NativeTabs，iOS 系统决定实际外观。
- iOS 26+ 且运行时支持时，玻璃容器使用 `expo-glass-effect` 的原生 `UIVisualEffectView`。
- 较旧 iOS 使用 `expo-blur`；Android 与 Web 使用实色表面。
- 跟随系统浅色 / 深色，尊重减少透明度，字号跟随系统。
- 这是一款 React Native 应用，具有 SwiftUI 风格；屏幕不是全部用 SwiftUI 编写的。

## 检查

```sh
npm run typecheck
npm test
npm run format:check
npm run export:ios
npm run export:web
```

JavaScript bundle 导出不等于 Xcode 编译或真机验收。原生玻璃、VoiceOver、系统大字号、手势返回及设备安全区需在 iOS / Android 设备上验证。
