# Frontend Progress Log

## 2026-03-13 — AI Stock Screener Feature

Implemented full-stack AI Stock Screener feature (`/dashboard/stock-screener`).

### Backend (kolvex-backend-py)
- **Service layer**: `app/services/stock_screener/` — screener_service.py (core filtering + Redis caching), strategies.py (6 pre-built strategies), ai_scorer.py (LLM-based multi-dimensional scoring)
- **API routes**: `app/api/routes/stock_screener.py` — GET strategies, POST screen, POST ai-analyze, CRUD presets
- **Scheduler**: Daily cache warming job (6:00 AM ET) pre-fetches S&P 500 financial data into Redis
- **Migration**: `migrations/create_screener_presets_table.sql` — user-saved screening presets with RLS

### Frontend (kolvex-frontend-web-nextjs)
- **Page**: `app/dashboard/stock-screener/page.tsx`
- **Components** (6 files in `components/stock-screener/`):
  - `StockScreenerPageClient.tsx` — orchestrator: strategy selection, filter state, screening, AI analysis
  - `StrategyCard.tsx` — 6 strategy template cards (Value, Growth, Momentum, Dividend, Oversold, Quality GARP)
  - `ScreenerFilterPanel.tsx` — collapsible multi-dimension filter panel with sector chips
  - `ScreenerResultsTable.tsx` — sortable, paginated results table with AI score badges
  - `AIInsightPanel.tsx` — AI scoring display with dimension bar charts and summary
  - `ScreenerSkeleton.tsx` — loading skeleton
- **API proxy**: `app/api/stock-screener/[...path]/route.ts`
- **API client**: `lib/stockScreenerApi.ts` — types, fetch functions, filter/sector constants
- **Sidebar**: Added "AI Screener" nav item with `SlidersHorizontal` icon
- **i18n**: Added `sidebar.stockScreener` + `stockScreener.*` keys for en/zh

---

## 2026-03-13 — Cursor Skill: Bundled Claude Design Skills

Created a comprehensive Cursor skill at `.cursor/skills/claude-design-skills/` that consolidates all 17 `.claude/skills` into a single bundled skill for Cursor IDE.

### Structure (7 files, 1362 total lines)
- `SKILL.md` (196 lines) — Main skill with core design principles, AI slop test, command catalog, implementation guidelines
- `design-reference.md` (394 lines) — Consolidated typography, color (OKLCH), spatial design, motion, interaction, responsive, UX writing reference
- `commands-review.md` (157 lines) — audit, critique, polish workflows
- `commands-enhance.md` (169 lines) — animate, bolder, colorize, delight workflows
- `commands-refine.md` (158 lines) — quieter, distill, clarify, normalize workflows
- `commands-build.md` (223 lines) — adapt, harden, optimize, extract, onboard workflows
- `teach-impeccable.md` (65 lines) — One-time design context setup workflow

### Commands Bundled (17 total)
| Group | Commands |
|-------|----------|
| Review | audit, critique, polish |
| Enhance | animate, bolder, colorize, delight |
| Refine | quieter, distill, clarify, normalize |
| Build | adapt, harden, optimize, extract, onboard |
| Setup | teach-impeccable |

## 2026-03-13 — Impeccable Design System Optimization

Comprehensive frontend optimization following pbakaus/impeccable design principles across typography, color, layout, motion, interaction, and UX writing.

### Files Modified (15 files)

**Foundation:**
- `app/globals.css` — Tinted neutrals with OKLCH, exponential easing curves, `prefers-reduced-motion` support, removed bounce easing, removed glassmorphism/glow anti-patterns, fixed height animations to use transform
- `tailwind.config.ts` — OKLCH tinted neutral palette, exponential animation curves (ease-out-quart/quint), semantic color tokens
- `components/ui/button.tsx` — Active state feedback (`scale-[0.97]`), proper easing, semantic color usage

**Landing Page:**
- `components/landing/LandingHero.tsx` — Removed gradient text, neon particles, hero metrics mockup, glow effects; replaced with left-aligned editorial layout
- `components/landing/LandingFeatures.tsx` — Removed identical stats-in-card pattern, oversized icons; clean cards with left-aligned header
- `components/landing/LandingStats.tsx` — Removed card wrappers around stats, decorative dots, glow blobs; clean typographic layout with border separators
- `components/landing/LandingCTA.tsx` — Removed canvas particles, decorative corner borders, glow shadows; clean centered layout
- `components/landing/LandingHowItWorks.tsx` — Removed blur blobs, glow shadows; semantic colors, proper easing
- `components/landing/LandingTestimonials.tsx` — Removed backdrop-blur, overshoot star animation; semantic tokens
- `components/landing/LandingStockTicker.tsx` — Removed gradient borders, backdrop-blur; semantic surface colors

**Layout & Common:**
- `components/layout/AppShell.tsx` — Semantic `bg-background`/`text-foreground` tokens
- `components/layout/Sidebar.tsx` — Semantic destructive color for notification badge, tabular-nums
- `components/layout/Footer.tsx` — Removed gradient border, rounded accent bars, glow shadow on button
- `components/common/LoadingSpinner.tsx` — Removed gradient glow, sparkles icon, glassmorphism card; clean spinner

**News:**
- `components/news/NewsCard.tsx` — Removed backdrop-blur, proper semantic borders
- `components/news/LiveNewsList.tsx` — Removed glassmorphism from skeletons

### Anti-Patterns Removed
1. **Bounce/elastic easing** → Exponential ease-out-quart curves
2. **Height/width animations** → Transform (scaleY/scaleX) only
3. **No prefers-reduced-motion** → Full reduced-motion media query
4. **Glassmorphism utilities** → Purposeful surface styles
5. **Neon glow effects** → Subtle elevation shadows
6. **Gradient text** → Solid color with clear hierarchy
7. **Hero metric template** → Typographic stats without card wrappers
8. **Canvas particles** → Removed (decorative noise)
9. **Pure gray/black** → OKLCH tinted neutrals (chroma 0.005–0.01, hue 145)
10. **Generic `ease`/`ease-out`** → `cubic-bezier(0.25, 1, 0.5, 1)` throughout

## 2026-03-13 — Dark Mode Semantic Token Migration (Business Components)

Replaced legacy light/dark class pairs with auto-switching semantic Tailwind tokens across 22 business components. CSS variables handle theme switching; no more `dark:` prefixes for standard surface/text/border colors.

### Replacement Rules Applied
| Pattern | Replacement |
|---|---|
| `bg-white dark:bg-card-dark` / `bg-card-light dark:bg-card-dark` | `bg-card` |
| `bg-background-light dark:bg-background-dark` | `bg-background` |
| `border-border-light dark:border-border-dark` | `border-border` |
| `border-gray-200 dark:border-gray-700` | `border-border` |
| `text-gray-900 dark:text-white` | `text-foreground` |
| `text-gray-500/600 dark:text-white/50/60` | `text-muted-foreground` |
| `bg-border-light dark:bg-border-dark` | `bg-border` |
| `divide-border-light dark:divide-border-dark` | `divide-border` |
| `dark:bg-background-dark` (standalone) | `bg-background` |
| `!border-border-light/50 dark:!border-border-dark/50` | `!border-border/50` |
| `hover:border-border-light/80 dark:hover:border-border-dark/80` | `hover:border-border/80` |
| `bg-card-light dark:bg-card-dark/50` (opacity variant) | `bg-card` |

### Files Modified (22 files)
- `components/trading-analysis/debate-card.tsx`
- `components/trading-analysis/report-card.tsx`
- `components/trading-analysis/skeletons.tsx`
- `components/kol/KOLPageClient.tsx`
- `components/kol/KOLTrackerTable.tsx`
- `components/kol/MyTrackingRequests.tsx`
- `components/options-flow/OptionsAIHistory.tsx`
- `components/options-flow/OptionsAIAssistant.tsx`
- `components/options-flow/OptionsChainTable.tsx`
- `components/post/PostDetailModal.tsx`
- `components/user/EmailSignup.tsx`
- `components/ui/company-logo.tsx`
- `components/analytics/EngagementHeatmap.tsx`
- `components/analytics/SentimentChart.tsx`
- `components/analytics/SentimentTrendChart.tsx`
- `components/analytics/StatsCard.tsx`
- `components/landing/LandingFeatures.tsx`
- `components/landing/LandingHowItWorks.tsx`
- `components/landing/LandingStats.tsx`
- `components/landing/LandingStockTicker.tsx`
- `components/landing/LandingTestimonials.tsx`
- `components/layout/Footer.tsx`

## 2026-03-13 — Dark Mode Semantic Token Migration (Batch 3: Stock, Market, Portfolio, Tracking)

Continued replacing legacy light/dark class pairs with semantic Tailwind tokens across 15 more business components covering stock detail, market index, portfolio, and tracking pages.

### Additional Replacement Patterns Applied
| Pattern | Replacement |
|---|---|
| `bg-gray-200 dark:bg-white/10` (skeleton bg) | `bg-muted` |
| `bg-gray-100 dark:bg-white/5` / `bg-gray-50 dark:bg-white/5` | `bg-muted` |
| `text-gray-500 dark:text-gray-400` | `text-muted-foreground` |
| `text-gray-500 dark:text-white/50` | `text-muted-foreground` |
| `hover:bg-gray-50 dark:hover:bg-white/5` | `hover:bg-muted` |
| `border-gray-100 dark:border-white/5` | `border-border` |
| `border-border-light/50 dark:border-border-dark/50` | `border-border/50` |
| `border-border-light dark:border-primary/10` | `border-border` |
| `border-border-light dark:border-white/5` | `border-border` |
| `dark:border-border-dark` (standalone) | `border-border` |
| `dark:hover:bg-card-dark/90` (standalone) | `hover:bg-card/90` |
| `bg-card-light dark:bg-card-dark` | `bg-card` |

### Files Modified (15 files)
- `components/stock/StockInfoSkeleton.tsx` — 26 replacements
- `components/stock/StockPageClient.tsx` — 1 replacement
- `components/stock/stock-detail/StockCompanyProfile.tsx` — 12 replacements
- `components/stock/stock-detail/StockFinancialMetrics.tsx` — 20 replacements
- `components/stock/stock-detail/StockMarketData.tsx` — 25 replacements
- `components/stock/stock-detail/StockMobileHeader.tsx` — 12 replacements
- `components/stock/stock-detail/StockMobileStats.tsx` — 14 replacements
- `components/market/MarketIndex.tsx` — 5 replacements
- `components/portfolio/AccountCard.tsx` — 1 replacement
- `components/portfolio/allocation/SectorTable.tsx` — 2 replacements
- `components/portfolio/PortfolioPageContent.tsx` — 1 replacement
- `components/portfolio/PortfolioPerformanceChart.tsx` — 5 replacements
- `components/portfolio/PortfolioAIAnalysis.tsx` — 13 replacements
- `components/tracking-stocks/TrackingStocksTable.tsx` — 2 replacements
- `components/trending-stocks/index.tsx` — 2 replacements
