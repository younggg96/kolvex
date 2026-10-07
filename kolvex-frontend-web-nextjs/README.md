# Kolvex

A modern stock market analysis and tracking platform built with Next.js 14, TypeScript, and Tailwind CSS.

## Features

### 🎯 Landing Page (Home)

- 💚 Beautiful animated grid background
- ✨ Glowing border effect on email input focus
- 📧 Email signup form for early access
- 🌙 Dark theme with custom green accent (#53d22d)
- 📱 Fully responsive design
- 🎨 Material Symbols icons integration

### 📊 Dashboard (/dashboard)

- 🎯 Professional trading interface with sidebar navigation
- 📱 **Mobile-responsive sidebar** - Slide-out drawer menu on mobile devices
  - Menu button in header (mobile only)
  - Smooth slide-in/out animation
  - Overlay backdrop with click-to-close
  - Auto-collapse on navigation
  - Desktop collapsible sidebar preserved
- 📈 Market indices cards (Dow Jones, NASDAQ, S&P 500)
- 📊 Interactive Chart.js charts with multiple timeframes (1D, 1W, 1M, 1Y, ALL)
- 📰 "Market News" section with latest updates
- 🎨 Dark theme optimized for trading (#0D110D background)
- ⚡ Fast performance with Next.js App Router
- 🔍 Stock search functionality
- 📱 Fully responsive design

### 📲 Progressive Web App (PWA)

- ✨ **可安装应用** - 将应用添加到主屏幕，像原生应用一样使用
- 🔄 **离线支持** - Service Worker 自动缓存，离线也能访问
- 🚀 **快速加载** - 智能缓存策略优化加载速度
- 📱 **原生体验** - 独立窗口模式，无浏览器地址栏
- 🎯 **应用快捷方式** - Chat、Portfolio、YouTube 股票观点快速访问
- 🍎 **iOS 支持** - 完美支持 iOS Safari 的添加到主屏幕功能
- 🤖 **Android 支持** - 完整的 Android PWA 安装体验

详细配置说明请查看：[PWA.md](./PWA.md)

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Charts:** Chart.js
- **Icons:** Material Symbols Outlined
- **Fonts:** Manrope (Google Fonts)
- **PWA:** @ducanh2912/next-pwa (Progressive Web App support)

## 📊 获取真实股票数据

**当前状态**: 如果没有配置 API keys，系统会使用模拟数据。

### 快速配置（5 分钟）

1. **注册免费 API Key**

   - 访问：https://www.alphavantage.co/support/#api-key
   - 输入邮箱，立即获得免费 key

2. **创建环境变量文件**

   ```bash
   # 在项目根目录创建 .env.local 文件
   echo "NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY=你的API_KEY" > .env.local
   ```

3. **重启开发服务器**
   ```bash
   npm run dev
   ```

✅ **完成！** 现在你会看到真实的股票数据了。

📖 详细配置说明请查看：[STOCK_API_SETUP.md](./STOCK_API_SETUP.md)

---

## Getting Started

### Installation

```bash
# Install dependencies
npm install
# or
yarn install
# or
pnpm install
```

### Development

```bash
# Run the development server
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Generate PWA Icons

If you need to regenerate PWA icons:

```bash
npm run generate-icons
```

This will create all required icon sizes from `public/icon.svg`.

### Build

```bash
# Create production build
npm run build
# or
yarn build
# or
pnpm build
```

### Production

```bash
# Start production server
npm start
# or
yarn start
# or
pnpm start
```

## Project Structure

```
kolvex/
├── app/                     # Next.js App Router pages
│   ├── dashboard/           # Stock dashboard route
│   │   └── page.tsx        # Dashboard page
│   ├── layout.tsx          # Root layout with dark mode
│   ├── page.tsx            # Email signup landing page
│   └── globals.css         # Global styles with animations
├── components/                  # React components
│   ├── EmailSignup.tsx          # Email signup form component
│   ├── Sidebar.tsx              # Vertical navigation sidebar
│   ├── MarketIndex.tsx          # Market index card component
│   ├── Watchlist.tsx            # Stock watchlist component
│   ├── MarketNews.tsx           # Market news component
│   ├── Header.tsx               # Header component (legacy)
│   ├── StockCard.tsx            # Stock card component (legacy)
│   └── StockChart.tsx           # Chart component (legacy)
├── lib/                    # Utility functions
│   └── utils.ts           # Helper utilities
├── public/                # Static assets
├── next.config.js         # Next.js configuration
├── tailwind.config.ts     # Tailwind CSS configuration (extended)
└── tsconfig.json          # TypeScript configuration
```

## Routes

- `/` - Email signup landing page with animated background
- `/dashboard` - Stock market dashboard with charts and cards

## License

MIT
