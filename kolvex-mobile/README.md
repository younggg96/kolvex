# Kolvex Mobile

React Native / Expo SDK 58 手机客户端，中文优先，沿用现有 Next.js / FastAPI / Supabase 产品数据和权限。

## 当前功能

- 行情与股票详情：真实报价、每日历史图、公司资料、核心财务指标、三张年度/季度报表、报表柱状图/列表、CSV 文本分享、盈利预期对比、分析师目标价和相关新闻。
- 创作者内容：YouTube 股票/方向筛选与分页、原视频来源；X 原文与股票筛选；Reddit 社区、排序、搜索和自选过滤。
- 账户：现有邮箱/密码登录、注册、验证提示、资料修改、退出当前设备。密码找回可打开现有网页版。
- 自选：访客列表留在本机；登录后读取与网页相同的 `user_watchlist`。逐股票写入，沿用现有 RLS；不自动合并访客列表。
- 日报：盘前/盘中/盘后筛选、分页、完整内容、配图、来源链接及已上传的中文版本。
- AI 研究：已完成报告列表、股票筛选、全文、多空和风险讨论。权限沿用后端 signed-in reader 接口。
- Ask Kolvex：账户对话列表、新建和继续对话、流式回复、停止、异常后的记录核对；可选资料来源及本轮股票报价上下文。沿用服务端默认模型。
- 投资组合：读取网页已连接的账户和持仓，包括期权元数据、同步时间及股票详情入口。
- 原生玻璃：NativeTabs、Liquid Glass 可用性检测、旧版 iOS 模糊降级、系统深浅色和字号；新闻与自选使用虚拟列表。

完整功能对应与尚未移植的部分见 [MIGRATION.md](./MIGRATION.md)。代码已接入不等于登录后真实账户和原生设备均已验收。

## 启动

需要 Node.js 22.13+。

```sh
cd kolvex-mobile
npm ci
cp .env.example .env
npm start
```

配置 `.env`，不要提交真实值：

```dotenv
EXPO_PUBLIC_API_URL=https://your-backend/api/v1
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-public-publishable-or-anon-key
EXPO_PUBLIC_WEB_URL=https://your-website
```

Supabase 使用与网页相同的项目。只接受 publishable / legacy anon 公共密钥，拒绝服务密钥。现有 `user_watchlist` 表及 RLS 迁移必须已部署。移动端不需要数据库服务密钥或模型密钥。

开发后端默认端口 8080：iOS 模拟器可用 `http://127.0.0.1:8080/api/v1`，Android 模拟器可用 `http://10.0.2.2:8080/api/v1`；真机需用开发机局域网地址且后端监听 `0.0.0.0`。HTTP 受设备网络策略限制，生产使用 HTTPS。修改环境变量后重新启动 Metro。Web 预览的来源必须在后端 CORS 允许列表中。

```sh
npm run ios
npm run android
npm run web
```

使用匹配 SDK 58 的 Expo Go 或 development build。原生本地构建可用 `npx expo run:ios` / `npx expo run:android`；分别需要完整 Xcode 或 Android SDK。`ios/`、`android/` 由 Expo 生成，不手工维护。

Web 是 React Native Web 预览，不展示原生玻璃。原生会话通过 SecureStore 分块加密存储；Web 预览仅保留内存会话，刷新后重新登录。

## 数据与错误边界

未配置 API 时，仅行情使用明确标记的静态演示样本；不编造创作者、研究、日报或账户内容。真实接口失败不会切换为演示数据。

FastAPI 请求直接使用 `/api/v1`，与 Next.js Cookie 代理分离。私有 API 通过 Bearer token 认证，账户切换后的旧结果被拒绝；退出或换账号会重建页面状态。云端自选直接使用已有 Supabase RLS。Reddit 通过后端 `/reddit-opinions` 代理读取 ApeWisdom，按社区缓存五分钟，不发送账户 token 给数据源。首次更新需重启后端加载新增路由。

普通读取有超时、取消和重试；写入不自动重放。聊天 SSE 支持分片 UTF-8、CRLF、断流和取消；取消不代表服务端回滚，必须读取最新记录后才能再次发送。报价上下文独立于用户问题传递，不粘贴进历史问题。

## 检查

```sh
npm run typecheck
npm run lint
npm test
npm run format:check
npx expo-doctor
npx expo export --platform all --output-dir dist-verified
```

实际验证范围及限制见 [VERIFICATION.md](./VERIFICATION.md)。Metro 导出不是 Xcode / Gradle 编译或真机验收。
