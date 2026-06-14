# 📚 Kolvex 项目完整文档

> 本文档用于 Gemini Gem 上下文参考，包含 Kolvex 的 UI 描述、技术栈清单和 API 文档

---

## 🎯 项目概述

**Kolvex** 是一个综合性的股票分析平台，整合社交媒体内容、市场数据和关键意见领袖（KOL）追踪功能，为投资者提供实时洞察。

### 产品定位

- **目标用户**: 个人投资者、金融分析师、投资爱好者
- **核心价值**: 通过追踪 KOL 观点和情感分析，帮助用户做出更明智的投资决策
- **支持平台**: Web (响应式) + PWA (移动端)

### 核心功能模块

| 模块              | 功能描述                         |
| ----------------- | -------------------------------- |
| 📊 **股票追踪**   | 实时股票数据、技术图表、价格提醒 |
| 👥 **KOL 追踪**   | 多平台 KOL 内容聚合、情感分析    |
| 💼 **投资组合**   | 券商账户集成、持仓管理、盈亏统计 |
| 📰 **财经新闻**   | 多平台新闻整合、AI 摘要          |
| 🏆 **超级投资者** | 追踪知名投资者持仓变动           |
| 👥 **社区**       | 公开投资组合、用户互动           |
| 🔔 **通知系统**   | 实时推送、订阅提醒               |

---

## 🛠️ 完整技术栈清单

### 前端技术栈 (Next.js)

#### 核心框架

```
Next.js           14.2.3      # React 全栈框架 (App Router)
React             18.3.1      # UI 库
TypeScript        5.4.5       # 类型安全
```

#### UI 与样式

```
TailwindCSS       3.4.3       # 原子化 CSS 框架
Radix UI          最新        # 无障碍组件库
  - @radix-ui/react-accordion
  - @radix-ui/react-avatar
  - @radix-ui/react-checkbox
  - @radix-ui/react-collapsible
  - @radix-ui/react-dialog
  - @radix-ui/react-dropdown-menu
  - @radix-ui/react-hover-card
  - @radix-ui/react-label
  - @radix-ui/react-popover
  - @radix-ui/react-radio-group
  - @radix-ui/react-select
  - @radix-ui/react-slot
  - @radix-ui/react-switch
  - @radix-ui/react-tabs
  - @radix-ui/react-tooltip
Lucide React      0.379.0     # 图标库
class-variance-authority      # 组件变体管理
clsx              2.1.1       # 类名合并工具
```

#### 数据可视化

```
Recharts          2.12.7      # React 图表库
Chart.js          4.5.1       # 通用图表库
```

#### 日期与时间

```
date-fns          3.6.0       # 日期处理库
react-day-picker  8.10.1      # 日期选择器
```

#### 状态与数据

```
@supabase/ssr     0.7.0       # Supabase SSR 支持
@supabase/supabase-js 2.78.0  # Supabase 客户端
```

#### 主题与交互

```
next-themes       0.4.6       # 主题切换
sonner            2.0.7       # Toast 通知
react-easy-crop   5.5.6       # 图片裁剪
```

#### 工具与服务

```
resend            6.4.2       # 邮件服务
@vercel/analytics 1.6.1       # 分析服务
@ducanh2912/next-pwa 10.2.9   # PWA 支持
```

#### 开发工具

```
ESLint            8.57.0      # 代码检查
PostCSS           8.4.38      # CSS 处理
Autoprefixer      10.4.19     # CSS 前缀
Sharp             0.34.4      # 图片处理
```

---

### 后端技术栈 (Python/FastAPI)

#### 核心框架

```
FastAPI           0.115.0     # 高性能异步 Web 框架
Uvicorn           0.32.0      # ASGI 服务器
Pydantic          2.9.2       # 数据验证
pydantic-settings 2.6.0       # 配置管理
```

#### 数据库

```
SQLAlchemy        2.0.35      # ORM
Alembic           1.13.3      # 数据库迁移
asyncpg           0.30.0+     # PostgreSQL 异步驱动
Supabase          2.7.4       # BaaS 平台
postgrest         0.16.8      # PostgREST 客户端
```

#### 认证与安全

```
python-jose       3.3.0       # JWT 处理
passlib           1.7.4       # 密码加密 (bcrypt)
python-multipart  0.0.12      # 文件上传
email-validator   2.2.0       # 邮箱验证
```

#### HTTP 与网络

```
httpx             0.27.2      # 异步 HTTP 客户端
```

#### 定时任务

```
APScheduler       3.10.4      # 任务调度
```

#### 数据获取

```
yfinance          0.2.40+     # Yahoo Finance 股票数据
Playwright        1.40.0+     # 浏览器自动化爬虫
BeautifulSoup4    4.12.0+     # HTML 解析
lxml              5.0.0+      # XML/HTML 解析器
```

#### 第三方集成

```
MCP               1.0.0+      # Model Context Protocol
```

---

## 🎨 UI 架构与设计系统

### 设计原则

1. **现代化**: 简洁、专业的金融科技风格
2. **响应式**: 支持桌面端和移动端
3. **无障碍**: 基于 Radix UI 的 A11y 支持
4. **主题化**: 深色/浅色模式切换

### 主题配置

```css
/* 主题 CSS 变量 (globals.css) */
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;
  --popover: 0 0% 100%;
  --popover-foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96.1%;
  --secondary-foreground: 222.2 47.4% 11.2%;
  --muted: 210 40% 96.1%;
  --muted-foreground: 215.4 16.3% 46.9%;
  --accent: 210 40% 96.1%;
  --accent-foreground: 222.2 47.4% 11.2%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 210 40% 98%;
  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 222.2 84% 4.9%;
  --radius: 0.5rem;
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  /* ... 深色主题变量 */
}
```

### 字体系统

```typescript
// 主字体: Manrope (Google Fonts)
const manrope = Manrope({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});
```

### 页面路由结构

```
/                                 # 落地页 (公开)
├── /auth                         # 登录/注册
│   ├── /forgot-password          # 忘记密码
│   └── /reset-password           # 重置密码
├── /dashboard                    # 主仪表板 (需登录)
│   ├── /                         # 首页概览
│   ├── /kol                      # KOL 追踪列表
│   │   └── /[username]           # KOL 详情页
│   ├── /stocks                   # 股票追踪
│   │   └── /[symbol]             # 股票详情页
│   ├── /portfolio                # 投资组合
│   ├── /news                     # 新闻资讯
│   ├── /investors                # 超级投资者
│   │   └── /[id]                 # 投资者详情
│   ├── /notifications            # 通知中心
│   └── /settings                 # 个人设置
├── /community                    # 社区
│   └── /[userId]                 # 公开投资组合
├── /contact                      # 联系我们
├── /privacy                      # 隐私政策
└── /terms                        # 服务条款
```

### 核心组件库

#### 布局组件 (`components/layout/`)

| 组件              | 用途                   |
| ----------------- | ---------------------- |
| `BaseLayout`      | 基础页面容器           |
| `DashboardLayout` | 仪表板布局（含侧边栏） |
| `Header`          | 顶部导航栏             |
| `LandingHeader`   | 落地页导航             |
| `Sidebar`         | 侧边导航菜单           |
| `Footer`          | 页脚                   |
| `SectionCard`     | 卡片式内容区块         |
| `SectionHeader`   | 区块标题               |

#### 股票组件 (`components/stock/`)

| 组件                | 用途                 |
| ------------------- | -------------------- |
| `StockCard`         | 股票概览卡片         |
| `StockRow`          | 股票列表行           |
| `StockChart`        | 股票走势图           |
| `TradingViewChart`  | TradingView 嵌入图表 |
| `MiniSparkline`     | 迷你走势线           |
| `StockSearchDialog` | 股票搜索对话框       |
| `StockInfoBoard`    | 股票信息面板         |
| `StockHeroSection`  | 股票详情页头部       |

**StockCard 示例结构:**

```tsx
interface StockCardProps {
  symbol: string; // 股票代码
  name: string; // 公司名称
  price: number; // 当前价格
  change: number; // 涨跌额
  changePercent: number; // 涨跌幅 %
}
```

#### KOL 组件 (`components/kol/`)

| 组件               | 用途           |
| ------------------ | -------------- |
| `KOLTweetCard`     | KOL 帖子卡片   |
| `KOLTrackerTable`  | KOL 追踪表格   |
| `KOLRankingTable`  | KOL 排行榜     |
| `KOLProfileHeader` | KOL 资料头部   |
| `KOLHoverCard`     | KOL 悬浮预览卡 |
| `KOLHeroSection`   | KOL 页面头部   |

**KOLTweetCard 功能:**

- 显示 KOL 头像、用户名、认证标识
- 帖子内容（支持展开收起）
- 互动数据（点赞、转发、评论）
- 情感标签（bullish/bearish/neutral）
- 股票标签（提及的股票代码）
- 复制内容、查看原帖按钮

#### 投资组合组件 (`components/portfolio/`)

| 组件                    | 用途             |
| ----------------------- | ---------------- |
| `PortfolioHoldings`     | 持仓列表         |
| `EquityPositionsTable`  | 股票持仓表格     |
| `OptionPositionsTable`  | 期权持仓表格     |
| `PortfolioAllocation`   | 资产配置饼图     |
| `PortfolioStatsGrid`    | 组合统计数据网格 |
| `AccountCard`           | 券商账户卡片     |
| `PrivacySettingsDialog` | 隐私设置对话框   |
| `ConnectionStates`      | 连接状态显示     |

#### 分析组件 (`components/analytics/`)

| 组件                  | 用途             |
| --------------------- | ---------------- |
| `AnalyticsDashboard`  | 分析仪表板       |
| `SentimentChart`      | 情感分布图       |
| `SentimentTrendChart` | 情感趋势图       |
| `EngagementHeatmap`   | 互动热力图       |
| `KOLBubbleChart`      | KOL 影响力气泡图 |
| `TickerHeatmap`       | 股票热度图       |
| `TrendChart`          | 趋势折线图       |
| `StatsCard`           | 统计数据卡片     |

#### 通用组件 (`components/common/`)

| 组件                     | 用途            |
| ------------------------ | --------------- |
| `AIAnalysis`             | AI 分析结果展示 |
| `SentimentBadge`         | 情感标签        |
| `LoadingSpinner`         | 加载动画        |
| `LoadingSkeleton`        | 骨架屏          |
| `EmptyState`             | 空状态提示      |
| `SearchWithAutocomplete` | 自动完成搜索框  |
| `ImageGallery`           | 图片画廊        |
| `VideoPlayer`            | 视频播放器      |
| `ExpandableText`         | 可展开文本      |
| `TranslateButton`        | 翻译按钮        |
| `Tags`                   | 标签组          |

#### 基础 UI 组件 (`components/ui/`)

基于 Radix UI 封装的无障碍组件：

- `Button` - 按钮
- `Card` - 卡片
- `Dialog` - 对话框
- `Dropdown` - 下拉菜单
- `Select` - 选择器
- `Switch` - 开关
- `Tabs` - 标签页
- `Tooltip` - 提示
- `Avatar` - 头像
- `Badge` - 徽章
- `Input` - 输入框
- `Textarea` - 文本域
- `Checkbox` - 复选框
- `Radio` - 单选框
- `Slider` - 滑块
- `Progress` - 进度条
- `Skeleton` - 骨架屏
- `Table` - 表格
- `Accordion` - 手风琴
- `Collapsible` - 可折叠
- `Popover` - 弹出框
- `HoverCard` - 悬浮卡
- `Sheet` - 抽屉
- `Sonner` - Toast 通知

---

## 📡 API 接口文档

### 基础配置

```
开发环境: http://localhost:8000
生产环境: https://api.kolvex.com

认证方式: Bearer Token (JWT)
Content-Type: application/json
```

### 通用响应格式

**成功响应:**

```json
{
  "data": { ... },
  "message": "Success",
  "success": true
}
```

**分页响应:**

```json
{
  "items": [...],
  "total": 100,
  "page": 1,
  "page_size": 20,
  "has_more": true
}
```

**错误响应:**

```json
{
  "detail": "Error message",
  "status_code": 400
}
```

---

### 1. 认证模块 (`/api/auth/`)

#### 用户注册

```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "用户名"
}
```

#### 用户登录

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123"
}

Response:
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "用户名"
  }
}
```

#### 刷新 Token

```http
POST /api/auth/refresh
Authorization: Bearer <refresh_token>
```

---

### 2. KOL 帖子模块 (`/api/kol-tweets/`)

#### 获取帖子列表

```http
GET /api/kol-tweets/
```

**查询参数:**
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | int | 否 | 页码，默认 1 |
| page_size | int | 否 | 每页数量，默认 20，最大 100 |
| platform | string | 否 | 平台：twitter, xiaohongshu, reddit, youtube |
| username | string | 否 | 按用户名筛选 |
| usernames | string | 否 | 多用户名（逗号分隔）|
| search | string | 否 | 搜索关键词 |
| sentiment | string | 否 | 情感：bullish, bearish, neutral |
| stock_related | bool | 否 | 是否股票相关 |
| ticker | string | 否 | 股票代码 |

**响应:**

```json
{
  "posts": [
    {
      "id": "uuid",
      "username": "elonmusk",
      "display_name": "Elon Musk",
      "avatar_url": "https://...",
      "content": "Tesla is doing great! $TSLA to the moon 🚀",
      "platform": "twitter",
      "permalink": "https://twitter.com/...",
      "like_count": 125000,
      "repost_count": 15000,
      "reply_count": 8500,
      "view_count": 5000000,
      "ai_sentiment": "bullish",
      "ai_sentiment_confidence": 0.92,
      "ai_tickers": ["TSLA"],
      "ai_summary": "看好特斯拉前景",
      "ai_is_stock_related": true,
      "created_at": "2025-01-08T10:30:00Z",
      "scraped_at": "2025-01-08T10:35:00Z"
    }
  ],
  "total": 1500,
  "page": 1,
  "page_size": 20,
  "has_more": true
}
```

#### 获取用户帖子

```http
GET /api/kol-tweets/user/{username}?platform=twitter&page=1&page_size=20
```

---

### 3. KOL 资料模块 (`/api/kol-tweets/profiles/`)

#### 获取 KOL 列表

```http
GET /api/kol-tweets/profiles/
```

**查询参数:**
| 参数 | 类型 | 说明 |
|------|------|------|
| page | int | 页码 |
| page_size | int | 每页数量 |
| platform | string | 平台筛选 |
| search | string | 搜索用户名/显示名 |
| sort_by | string | 排序：followers, tweets, engagement |

**响应:**

```json
{
  "profiles": [
    {
      "id": "uuid",
      "username": "cathiewood",
      "display_name": "Cathie Wood",
      "avatar_url": "https://...",
      "bio": "CEO & CIO of ARK Invest",
      "platform": "twitter",
      "followers_count": 1500000,
      "following_count": 200,
      "tweets_count": 8500,
      "verified": true,
      "is_tracked": true,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 50,
  "page": 1,
  "has_more": true
}
```

#### 获取单个 KOL 资料

```http
GET /api/kol-tweets/profiles/{username}
```

---

### 4. 股票模块 (`/api/stocks/`)

#### 搜索股票

```http
GET /api/stocks/search?q=apple&limit=10
```

**响应:**

```json
{
  "results": [
    {
      "symbol": "AAPL",
      "name": "Apple Inc.",
      "exchange": "NASDAQ",
      "type": "stock",
      "logo_url": "https://..."
    }
  ]
}
```

#### 获取股票详情

```http
GET /api/stocks/tickers/{symbol}
```

**响应:**

```json
{
  "symbol": "AAPL",
  "name": "Apple Inc.",
  "price": 185.5,
  "change": 2.35,
  "change_percent": 1.28,
  "open": 183.2,
  "high": 186.1,
  "low": 182.8,
  "volume": 45000000,
  "market_cap": 2850000000000,
  "pe_ratio": 28.5,
  "eps": 6.51,
  "dividend_yield": 0.52,
  "52_week_high": 199.62,
  "52_week_low": 164.08
}
```

#### 获取热门股票

```http
GET /api/stocks/trending?period=24h&limit=20
```

---

### 5. 股票追踪模块 (`/api/stocks/tracked/`)

#### 获取追踪的股票

```http
GET /api/stocks/tracked
Authorization: Bearer <token>
```

**响应:**

```json
{
  "stocks": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "symbol": "NVDA",
      "company_name": "NVIDIA Corporation",
      "logo_url": "https://...",
      "notify": true,
      "created_at": "2025-01-01T00:00:00Z",
      "mention_count": 156,
      "sentiment_score": 78.5,
      "trending_score": 2450.5,
      "engagement_score": 125000,
      "unique_authors_count": 45,
      "top_authors": [
        {
          "username": "jimcramer",
          "display_name": "Jim Cramer",
          "avatar_url": "https://...",
          "platform": "twitter",
          "tweet_count": 12,
          "sentiment": "bullish"
        }
      ],
      "last_seen_at": "2025-01-08T09:30:00Z"
    }
  ],
  "total": 8
}
```

#### 添加追踪股票

```http
POST /api/stocks/tracked
Authorization: Bearer <token>
Content-Type: application/json

{
  "symbol": "AAPL",
  "company_name": "Apple Inc.",
  "logo_url": "https://...",
  "notify": true
}
```

#### 更新追踪设置

```http
PATCH /api/stocks/tracked/{stock_id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "notify": false
}
```

#### 删除追踪股票

```http
DELETE /api/stocks/tracked/{stock_id}
Authorization: Bearer <token>
```

#### 检查是否追踪

```http
GET /api/stocks/tracked/check/{symbol}
Authorization: Bearer <token>

Response:
{
  "symbol": "AAPL",
  "is_tracked": true,
  "stock_id": "uuid"
}
```

---

### 6. Portfolio 投资组合模块 (`/api/portfolio/`)

#### 获取我的持仓

```http
GET /api/portfolio/holdings
Authorization: Bearer <token>
```

**响应:**

```json
{
  "accounts": [
    {
      "id": "uuid",
      "brokerage": "Interactive Brokers",
      "name": "Main Account",
      "number": "U1234567",
      "cash": 15000.5,
      "buying_power": 30000.0
    }
  ],
  "positions": [
    {
      "id": "uuid",
      "symbol": "AAPL",
      "name": "Apple Inc.",
      "quantity": 100,
      "average_price": 150.0,
      "current_price": 185.5,
      "market_value": 18550.0,
      "unrealized_pnl": 3550.0,
      "unrealized_pnl_percent": 23.67,
      "type": "equity",
      "is_hidden": false
    }
  ],
  "summary": {
    "total_value": 150000.0,
    "total_cost": 120000.0,
    "total_pnl": 30000.0,
    "total_pnl_percent": 25.0,
    "day_change": 1500.0,
    "day_change_percent": 1.01
  },
  "is_public": false,
  "last_synced_at": "2025-01-08T10:00:00Z"
}
```

#### 获取公开投资组合用户

```http
GET /api/portfolio/public-users?limit=20&offset=0&sort_by=pnl_percent&sort_order=desc
```

**响应:**

```json
{
  "users": [
    {
      "user_id": "uuid",
      "username": "trader_pro",
      "display_name": "专业交易员",
      "avatar_url": "https://...",
      "total_value": 500000.0,
      "pnl_percent": 45.5,
      "positions_count": 25,
      "last_synced_at": "2025-01-08T09:00:00Z"
    }
  ],
  "total": 150,
  "has_more": true
}
```

#### 获取用户公开持仓

```http
GET /api/portfolio/holdings/{user_id}
```

#### 切换公开分享

```http
POST /api/portfolio/toggle-public
Authorization: Bearer <token>
Content-Type: application/json

{
  "is_public": true
}
```

#### 隐藏/显示持仓

```http
POST /api/portfolio/positions/{position_id}/visibility
Authorization: Bearer <token>
Content-Type: application/json

{
  "is_hidden": true
}
```

#### 批量隐藏/显示持仓

```http
POST /api/portfolio/positions/visibility/batch
Authorization: Bearer <token>
Content-Type: application/json

{
  "position_ids": ["uuid1", "uuid2"],
  "is_hidden": true
}
```

#### 获取隐私设置

```http
GET /api/portfolio/privacy-settings
Authorization: Bearer <token>
```

**响应:**

```json
{
  "settings": {
    "is_public": true,
    "show_total_value": true,
    "show_pnl": true,
    "show_pnl_percent": true,
    "show_quantity": false,
    "show_cost_basis": false
  }
}
```

#### 更新隐私设置

```http
PUT /api/portfolio/privacy-settings
Authorization: Bearer <token>
Content-Type: application/json

{
  "show_total_value": true,
  "show_pnl": true,
  "show_pnl_percent": true,
  "show_quantity": false,
  "show_cost_basis": false
}
```

---

### 7. 超级投资者模块 (`/api/dataroma/`)

#### 获取投资者列表

```http
GET /api/dataroma/investors?page=1&page_size=20
```

**响应:**

```json
{
  "investors": [
    {
      "id": "uuid",
      "slug": "warren-buffett",
      "name": "Warren Buffett",
      "company": "Berkshire Hathaway",
      "portfolio_value": 350000000000,
      "portfolio_date": "2024-12-31",
      "top_holdings": ["AAPL", "BAC", "KO"],
      "avatar_url": "https://..."
    }
  ],
  "total": 50
}
```

#### 获取投资者详情

```http
GET /api/dataroma/investors/{slug}
```

#### 获取投资者持仓

```http
GET /api/dataroma/holdings/{investor_id}
```

**响应:**

```json
{
  "holdings": [
    {
      "symbol": "AAPL",
      "name": "Apple Inc.",
      "shares": 905000000,
      "value": 167000000000,
      "portfolio_percent": 47.8,
      "change_shares": 0,
      "change_type": "unchanged",
      "reported_date": "2024-12-31"
    }
  ],
  "summary": {
    "total_value": 350000000000,
    "positions_count": 45,
    "top_sector": "Technology"
  }
}
```

---

### 8. 通知模块 (`/api/notifications/`)

#### 获取通知列表

```http
GET /api/notifications/?page=1&page_size=20&unread_only=false
Authorization: Bearer <token>
```

**响应:**

```json
{
  "notifications": [
    {
      "id": "uuid",
      "type": "kol_post",
      "title": "新推文提醒",
      "message": "@elonmusk 提到了 $TSLA",
      "data": {
        "username": "elonmusk",
        "ticker": "TSLA",
        "post_id": "uuid"
      },
      "is_read": false,
      "created_at": "2025-01-08T10:00:00Z"
    }
  ],
  "total": 50,
  "unread_count": 5
}
```

#### 标记为已读

```http
PATCH /api/notifications/{id}/read
Authorization: Bearer <token>
```

#### 全部标记已读

```http
POST /api/notifications/read-all
Authorization: Bearer <token>
```

#### 删除通知

```http
DELETE /api/notifications/{id}
Authorization: Bearer <token>
```

---

### 9. 新闻模块 (`/api/news/`)

#### 获取新闻列表

```http
GET /api/news/?page=1&page_size=20&ticker=AAPL
```

**响应:**

```json
{
  "articles": [
    {
      "id": "uuid",
      "title": "Apple Announces New iPhone",
      "summary": "Apple unveiled...",
      "source": "Reuters",
      "url": "https://...",
      "image_url": "https://...",
      "published_at": "2025-01-08T08:00:00Z",
      "tickers": ["AAPL"],
      "sentiment": "bullish",
      "ai_summary": "苹果发布新款 iPhone..."
    }
  ],
  "total": 200
}
```

---

### 10. 小红书模块 (`/api/xiaohongshu/`)

#### 获取小红书 KOL

```http
GET /api/xiaohongshu/kols?page=1&page_size=20
```

#### 获取小红书帖子

```http
GET /api/xiaohongshu/posts?page=1&page_size=20&kol_id=xxx
```

**响应:**

```json
{
  "posts": [
    {
      "id": "uuid",
      "note_id": "xhs_note_id",
      "title": "今天聊聊美股投资",
      "content": "最近看好科技股...",
      "author": {
        "user_id": "xhs_user_id",
        "nickname": "投资小达人",
        "avatar": "https://..."
      },
      "images": ["https://...", "https://..."],
      "video_url": null,
      "like_count": 1500,
      "comment_count": 200,
      "collect_count": 500,
      "share_count": 100,
      "ai_sentiment": "bullish",
      "ai_tickers": ["NVDA", "AAPL"],
      "created_at": "2025-01-08T10:00:00Z"
    }
  ],
  "total": 100
}
```

---

### 11. AI 分析模块 (`/api/ai/`)

#### 分析帖子

```http
POST /api/ai/analyze-post
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "I think $NVDA is going to 🚀 this year!",
  "platform": "twitter"
}
```

**响应:**

```json
{
  "sentiment": "bullish",
  "sentiment_confidence": 0.95,
  "is_stock_related": true,
  "tickers": ["NVDA"],
  "summary": "看好 NVIDIA 今年的表现",
  "key_points": ["对 NVDA 持乐观态度", "预期股价上涨"]
}
```

---

### 12. 市场数据模块 (`/api/market-data/`)

#### 获取市场指数

```http
GET /api/market-data/indices
```

**响应:**

```json
{
  "indices": [
    {
      "symbol": "^GSPC",
      "name": "S&P 500",
      "value": 4750.25,
      "change": 25.5,
      "change_percent": 0.54
    },
    {
      "symbol": "^DJI",
      "name": "Dow Jones",
      "value": 37500.0,
      "change": 150.0,
      "change_percent": 0.4
    },
    {
      "symbol": "^IXIC",
      "name": "NASDAQ",
      "value": 15000.5,
      "change": 75.25,
      "change_percent": 0.5
    }
  ],
  "updated_at": "2025-01-08T16:00:00Z"
}
```

---

## 🔑 关键概念与术语表

| 术语      | 英文               | 说明                                    |
| --------- | ------------------ | --------------------------------------- |
| KOL       | Key Opinion Leader | 关键意见领袖，指有影响力的投资者/分析师 |
| 情感分析  | Sentiment Analysis | AI 分析帖子的市场情感倾向               |
| Bullish   | 看涨               | 对市场/股票持乐观态度                   |
| Bearish   | 看跌               | 对市场/股票持悲观态度                   |
| Neutral   | 中性               | 对市场/股票无明确倾向                   |
| Ticker    | 股票代码           | 如 AAPL, NVDA, TSLA                     |
| Portfolio | 券商聚合           | 连接用户真实券商账户的服务              |
| Dataroma  | 持仓数据源         | 追踪超级投资者持仓的数据来源            |
| PnL       | Profit and Loss    | 盈亏                                    |
| 持仓      | Position/Holdings  | 用户持有的股票/期权                     |
| 追踪      | Track/Subscribe    | 关注某个 KOL 或股票                     |

---

## 📁 项目目录结构

```
kolvex/
├── kolvex-frontend-web-nextjs/          # Next.js 前端应用
│   ├── app/                             # App Router 页面
│   │   ├── api/                         # API 路由 (BFF 层)
│   │   │   ├── auth/                    # 认证 API
│   │   │   ├── kol/                     # KOL API
│   │   │   ├── stocks/                  # 股票 API
│   │   │   ├── portfolio/               # 投资组合 API
│   │   │   └── ...
│   │   ├── auth/                        # 认证页面
│   │   ├── dashboard/                   # 仪表板页面
│   │   │   ├── kol/                     # KOL 追踪
│   │   │   ├── stocks/                  # 股票追踪
│   │   │   ├── portfolio/               # 投资组合
│   │   │   ├── news/                    # 新闻
│   │   │   ├── investors/               # 超级投资者
│   │   │   ├── notifications/           # 通知
│   │   │   └── settings/                # 设置
│   │   ├── community/                   # 社区
│   │   └── ...
│   ├── components/                      # React 组件
│   │   ├── analytics/                   # 分析组件
│   │   ├── auth/                        # 认证组件
│   │   ├── common/                      # 通用组件
│   │   ├── community/                   # 社区组件
│   │   ├── investors/                   # 投资者组件
│   │   ├── kol/                         # KOL 组件
│   │   ├── landing/                     # 落地页组件
│   │   ├── layout/                      # 布局组件
│   │   ├── market/                      # 市场组件
│   │   ├── news/                        # 新闻组件
│   │   ├── notifications/               # 通知组件
│   │   ├── portfolio/                   # 投资组合组件
│   │   ├── post/                        # 帖子组件
│   │   ├── stock/                       # 股票组件
│   │   ├── theme/                       # 主题组件
│   │   ├── tracking-stocks/             # 追踪股票组件
│   │   ├── trending-stocks/             # 热门股票组件
│   │   ├── ui/                          # 基础 UI 组件
│   │   ├── user/                        # 用户组件
│   │   └── xhs/                         # 小红书组件
│   ├── hooks/                           # 自定义 Hooks
│   │   ├── useAuth.ts
│   │   ├── useStockData.ts
│   │   ├── useTrackedKOLs.ts
│   │   └── ...
│   ├── lib/                             # 工具库
│   │   ├── api/                         # API 客户端
│   │   ├── supabase/                    # Supabase 配置
│   │   ├── analyticsApi.ts
│   │   ├── kolApi.ts
│   │   ├── stockApi.ts
│   │   └── ...
│   ├── public/                          # 静态资源
│   ├── tailwind.config.ts               # Tailwind 配置
│   └── package.json
│
├── kolvex-backend-py/                   # FastAPI 后端应用
│   ├── app/
│   │   ├── api/
│   │   │   ├── dependencies/            # 依赖注入
│   │   │   │   └── auth.py              # 认证依赖
│   │   │   └── routes/                  # API 路由
│   │   │       ├── auth/                # 认证路由
│   │   │       ├── kol_tweets/          # KOL 帖子路由
│   │   │       ├── stocks/              # 股票路由
│   │   │       ├── portfolio/           # Portfolio 路由
│   │   │       ├── dataroma/            # Dataroma 路由
│   │   │       ├── xiaohongshu/         # 小红书路由
│   │   │       ├── notifications.py     # 通知路由
│   │   │       ├── news.py              # 新闻路由
│   │   │       └── ...
│   │   ├── core/                        # 核心配置
│   │   │   ├── config.py                # 应用配置
│   │   │   └── supabase.py              # Supabase 客户端
│   │   ├── models/                      # 数据模型
│   │   ├── schemas/                     # Pydantic Schemas
│   │   └── services/                    # 业务服务层
│   │       ├── portfolio.py
│   │       ├── kol_service.py
│   │       └── ...
│   ├── migrations/                      # 数据库迁移
│   ├── main.py                          # 应用入口
│   └── requirements.txt                 # Python 依赖
│
└── README.md                            # 项目文档
```

---

## 🚀 开发与部署

### 本地开发

**前端:**

```bash
cd kolvex-frontend-web-nextjs
npm install
cp .env.example .env.local
npm run dev
# 访问 http://localhost:3000
```

**后端:**

```bash
cd kolvex-backend-py
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python main.py
# API 运行在 http://localhost:8000
```

### 生产部署

**前端 (Vercel):**

```bash
vercel --prod
```

**后端 (Docker):**

```bash
docker build -t kolvex-backend .
docker run -p 8000:8000 kolvex-backend
```

---

## 📞 支持

- GitHub: https://github.com/younggg96/kolvex
- Issues: https://github.com/younggg96/kolvex/issues

---

_文档最后更新: 2025-01-08_
