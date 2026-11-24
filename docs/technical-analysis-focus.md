# Technical analysis focus

This change extends the existing stock chart analysis rather than introducing a
second analysis pipeline. Next.js `PriceChart` shares a focus selection across its
compact and advanced charts; `ChartView` submits it through the existing authenticated
Next.js proxy to FastAPI. The Python service computes evidence and asks the existing
LLM provider for structured explanations. Existing immutable analysis snapshots save
both the request and response; no new database migration is needed for focus selection.

## Reading and generation

Open **Analysis focus / 分析内容** above the stock chart. The collapsed row previews
the selected topics. Expand it for a plain checkbox grid of common topics, and open
**More categories / 更多类别** for topics with incomplete data. Choose any combination
of the twelve categories, or add up to five custom scenarios (200 characters each).
Use **Add scenario / 添加情景** to reveal the optional input; Enter adds it and Escape
or Cancel closes it. Trend, momentum, levels, scenarios and invalidation are selected by default. At least
one category or custom scenario must remain. Selection is free of network side effects;
**Generate / Update analysis** applies the current focus. Custom questions are optional.
The separate chart-drawing action defaults to levels, trendlines and Fibonacci and
can add wave, pattern, candlestick and breakout annotations. It does not consume the
custom written-analysis focus and never returns a trade plan.
Controls are disabled during generation. Newly generated findings appear in both the
chart analysis panel and the stock page's AI Technical Analysis section. Both lead with
the summary and use a **Technical evidence / 分析依据** disclosure for topic details.
When topic findings exist, the legacy signal list is omitted to avoid repeating the
same evidence. Standard unavailable topics share a compact notice; unavailable custom
questions retain their individual explanations.

Each saved analysis keeps its own categories, scenarios and explanations. Loading a
saved version restores those choices for the next generation. Old snapshots without
focus fields still render and use the default selection. Unsaved choices are scoped to
the current stock chart; they are not stored in browser storage or sent to analytics.

## Advanced chart interaction and settings

In the advanced chart (Web `ChartView` → `PriceGraph`), hovering shows a crosshair: a
vertical rule on the bar under the pointer, a horizontal rule at the pointer with its
price tagged on the right axis, and the bar's date tagged on the time axis. A plain
drag on empty plot area pans (with release momentum); drawing tools and existing
drawings still claim their own drags first. The former **拖动平移 / Drag to pan**
toggle is gone.

The ⚙ **图表设置 / Chart settings** button in the top toolbar opens a dialog. Choices are
saved per browser under `kolvex:chart-settings` (`lib/chart/settings.ts`), are never
sent to the server, and **恢复默认 / Reset** restores the defaults:

- Zoom anchor: cursor (default) or right edge — wheel and toolbar zoom.
- Crosshair snap: off (default), close, or nearest of open/high/low/close.
- Extended hours (default on): minute and hour intervals request `prepost=true` from
  `GET /api/v1/market/history/{symbol}` for available pre-market, after-hours and
  [Blue Ocean ATS overnight bars](decision-workspace.md#美股盘前盘后和夜盘走势).
  Daily and longer intervals use the instrument's regular historical bars.
  AI analysis requests never send `prepost`, so it always reads regular-session bars.
- Highlight trading session (default on, needs extended hours): shades pre-market,
  after-hours and source-tagged overnight bars. A bar that overlaps the regular session counts as regular.
- Candle colours: body, border and wick each have an on/off switch and up/down colours
  chosen from design tokens (`--chart-up`, `--chart-down`, `--compare-1…6`,
  `--foreground`, `--muted-foreground`), plus 绿涨红跌 / 红涨绿跌 presets. Turning a part
  off keeps candles visible (hollow body, neutral wick or outline).

## Advanced chart indicators (技术指标)

The 技术指标 menu groups the overlays: **均线 MA** (simple average) 5 / 10 / 20 / 30 / 60 /
120 / 250, **指数均线 EMA** 5 / 10 / 12 / 20 / 26 / 50 / 100 / 200, and **其他** VWAP, Bollinger
(20, 2) and volume; 副图指标 (KDJ / MACD / RSI) follows. Periods are toggle chips; each line keeps
one colour in the plot, the legend and the menu (`components/youtube/chart/indicators.ts`).
The selection is saved per browser under `kolvex:chart-indicators:advanced`; defaults stay
volume, VWAP and EMA 20 / 50 / 200.

## Advanced chart rendering (zoom / pan performance)

Grid, extended-session shading, volume and candles are painted on one `<canvas>`
(`components/youtube/chart/PlotCanvas.tsx`, fed by `paintAdvancedCanvas` in `ChartView`); the
SVG above it keeps indicator lines, price tags, creator-call markers and AI drawings. Colours
come from the same CSS tokens (resolved at paint time) and the canvas repaints when the theme
changes. Wheel, pinch and drag steps build on the latest requested view and reach React at most
once per animation frame (`queueView` in `PriceGraph`). The watchlist, news, earnings and AI
analysis panels are memoized so a zoom frame doesn't re-render them.

Volume: the volume bars scale to the typical visible bar (3× the 95th percentile, capped at the
largest), so an opening or closing auction print reaches the top of the volume area instead of
flattening every other bar. The backend (`_drop_cumulative_volume` in
`kolvex-backend-py/app/services/yfinance/client.py`) blanks intraday bars where Yahoo reports
the day's running volume total on one bar (seen on NVDA 1m, 2026-11-23: 512M–616M on scattered
minutes); those bars return `volume: null`, never an estimate, and a 4h bar built from one is
`null` too.

## Advanced chart intervals (周期)

The interval menu always lists every interval: 1分钟 / 5分钟 / 15分钟 / 30分钟 / 1小时 / 4小时 /
日线 / 周线 / 月线 (`CHART_INTERVALS` in `lib/chart/range.ts`). Picking one the current range
can't hold switches the range (`rangeForInterval`: 1m and 5m → 1日, 15m and 30m → 1周, 1h → 1月,
4h → 3月, 1d → 6月, 1wk → 5年, 1mo → 全部), TradingView-style. History limits follow yfinance:
1m loads 5 days, 5m–30m one month, hourly (4h is resampled from 60m) about two years.

## 看盘 page (`/dashboard/chart`)

The sidebar's 盯盘 group has **看盘** between 行情 and 自选股. It opens the advanced chart as a
page of its own (`components/decision/ChartTerminal.tsx` → `PriceChart` with `terminal`), with
the same side panels, drawings, AI and settings as the stock page's full-screen chart. The
symbol lives in the URL (`?symbol=NVDA`); without one it reopens the last symbol charted there
(this browser), else SPY. Switch stocks with the symbol box (type, Enter) or a 自选 row; both
replace the URL instead of adding history. 个股页 opens the stock's full page. Feature flag: it
belongs to `home` (行情) in `lib/productFeatures.ts`.

## Advanced chart side panels (看盘)

On desktop (≥ `lg`) the advanced chart keeps the K-line on the left and a column of
flat, divider-separated panels on the right (`components/youtube/chart/AdvancedSidePanels.tsx`),
with a 44px icon rail on the far edge (TradingView-inspired). Each rail icon (自选 / AI 分析 /
新闻 / 财报) shows or hides its panel; the last icon, **排列面板 / Arrange panels**, reorders
them. Each panel's header collapses it or closes it. With every panel off only the rail
remains, so the chart takes the width. The layout is saved per browser under
`kolvex:advanced-chart-panels` (`lib/chart/sidePanels.ts`) and is never sent to the server.

Desktop chart chrome is dense: the symbol and the hovered bar's OHLC share one header line
(phones wrap OHLC to its own line), the drawing toolbar uses 28px buttons, the price line
carries the extended-hours quote inline, the range / interval / toggle strip is a 28px row
ruled off from the plot, and on desktop **画线图层 / Drawing layers** is a button in that strip
(shown / total count) opening the layer toggles in a popover — phones keep the 画线图层 row
and its bottom sheet. The oscillator pane is 80px tall and prints its values on its tab line. The plot has a
TradingView-style grid (a price rule about every 48px, a labelled vertical rule about every
110px) and the current price as a dotted line with a `SYMBOL | price` axis tag in the day's
up/down colour; a newer pre-market / after-hours / overnight quote adds its own dotted line
and `盘前 / 盘后 / 夜盘 | price` tag in `--chart-extended`. Below `xl` the 自选 table drops
the absolute 涨跌 column so tickers stay readable.
Phones keep 44px touch targets.

- **自选 / Watchlist** (default, first): the account-synced watchlist as a dense,
  TradingView-style table — 代码 / 最新价 / 涨跌 / 涨跌幅 (Symbol / Last / Chg / Chg%),
  using the newest session price (a 盘前 / 盘后 / 夜盘 tag marks extended hours).
  Rows stay grouped by sector (same grouping as the Watchlist page); each sector header
  folds its rows. Clicking a column header sorts within each sector (descending →
  ascending → saved order); stocks without a quote sink to the bottom. The charted row
  is highlighted with a left accent bar. A details block pinned under the list shows the
  charted stock's price, signed change, session, open / prev close / high / low /
  volume / market cap (— when the source has no value) and a link to its quote page.
  Selecting a row charts that stock inside the dialog; closing the dialog returns to the
  page's stock. The star adds or removes the charted stock. Signed-out readers see a
  sign-in action.
- **AI 分析 / AI analysis** (default, second): the AI actions and results that used to
  fill the column. Only offered when the chart has AI.
- **新闻 / News**: the charted stock's latest related news (same source as the stock
  page), with Chinese headlines when the interface is Chinese.
- **财报 / Earnings**: next report date and the last eight reported quarters' EPS
  estimate, actual and surprise (Yahoo Finance; missing values stay "—").

While another stock is charted, its AI analysis is not reported to the page's own
technical tab. Phones keep the existing AI sheet; the panel column is desktop-only.

## Reading saved analysis in another language

Saved results retain their generation language. If it differs from the Web
interface language, the chart analysis, conditional plan and AI Research library
offer an explicit translation action. It sends the generated reading text through
the existing translation endpoint. Conclusions, evidence and plan prose change
together within each panel once translation succeeds. Figures, score inputs,
chart geometry, user-authored scenarios and saved versions stay in their original
form. Readers can switch back to the original. The original remains available
during translation and on failure. Opening a page or switching interface language
does not initiate translation or generate a new analysis.

## API contract

`POST /api/v1/market/ai-technical/{symbol}` accepts its existing history, visible-window
and locale parameters plus:

```json
{
  "categories": ["trend", "levels", "volume", "scenarios"],
  "custom_scenarios": ["What would confirm a resistance breakout?"]
}
```

Category IDs: `trend`, `momentum`, `levels`, `structure`, `volume`, `volatility`,
`patterns`, `timeframes`, `score`, `historical`, `scenarios`, `invalidation`,
`trade_plan`. For written analysis, `trade_plan` asks the model to explain the
conditional setup; the setup itself is optional and server-validated. Drawings strip
`trade_plan` and force `setup` to null, because the single execution plan belongs to
written analysis.
Missing categories use defaults; an explicitly empty category list is permitted only
with a non-empty custom scenario. Duplicate values are removed, scenarios are trimmed,
and unknown IDs, excessive counts, oversized text or an empty total focus are rejected
by Pydantic (HTTP 422). The service also validates direct callers.

The existing result gains optional-compatible metadata:

```json
{
  "categories": ["volume"],
  "custom_scenarios": ["What would confirm a resistance breakout?"],
  "findings": [
    {"id": "volume", "status": "available", "explanation": "..."},
    {"id": "custom_0", "status": "unavailable", "explanation": "..."}
  ]
}
```

Custom IDs use their index in the saved `custom_scenarios` array. Requested order is
preserved. Unrequested model findings are discarded; missing findings become explicit
unavailable entries. The model's unavailable status is retained for custom questions.
Existing errors and settings/API-key recovery continue through the original endpoint.

## Evidence and limitations

- Trends and momentum reuse server-computed EMA20/50/200 and RSI14.
- Levels and structure reuse computed swing points and clustered level candidates.
- Volatility adds ATR percentage; volume adds current volume divided by the preceding
  twenty candles' average volume. Missing or zero volume yields unavailable evidence.
- Scenarios and invalidation explain conditional observations using existing levels.
- Pattern detection, multi-timeframe alignment, overall technical scoring and historical
  similarity have no complete deterministic engine in this endpoint. Their selected
  findings are forced to unavailable by the server, regardless of model output.
  This change does not implement the full quantitative roadmap in the attached brief.

The structured-output model adds `findings` (ID, status, explanation) to the existing
analysis schema. The prompt requires one finding per requested focus, disallows invented
indicators/scores/returns, and treats custom questions as untrusted data rather than
instructions. Standard unavailable findings use service-owned copy. Explanations for
supported topics remain LLM-generated; prompt instructions are not a guarantee of
perfect factual accuracy. Chart geometry continues through existing sanitation.

## Caching and files

The existing 600-second process cache now includes normalized category IDs and custom
scenario text in its key, alongside the original stock/window/locale keys. Different
focuses cannot reuse each other's explanations. The existing 200-entry bound remains.
Focus is saved in the current analysis-history JSON fields.

- `app/services/technical_focus.py`: category contract, validation, category guidance.
- `app/services/technical_analysis.py`: computed evidence, prompt, ordered findings, cache.
- `app/api/routes/market_data.py`: request schema and forwarding to the service.
- `lib/technicalFocus.ts`, `lib/stockApi.ts`: shared typed frontend request/result.
- `TechnicalFocusSelector`: shared controls using existing Input, Button and ChipButton.
- `TechnicalFindings`: shared result rendering used by stock workspace and chart panel.
- `PriceChart`, `ChartView`: shared selection, restoration and request integration.
- `lib/i18n/locales/{en,zh}.json`: labels, limits and validation messages.

## Verification

From the backend:

```sh
venv/bin/python -m unittest discover -s tests -p 'test_technical*.py'
```

Tests cover default/custom-only focus, unknown IDs, deduplication and limits, cache
isolation, unrequested/missing/unsupported findings, untrusted prompt placement,
relative-volume calculation and missing/zero-volume evidence. Existing chart algorithm
and sanitation tests remain in place.

Frontend verification uses TypeScript, targeted Next.js ESLint and the existing
`node --test scripts/decision-regressions.test.cjs` suite. Browser component checks use
local sample data; live stock generation still requires an authenticated account,
configured AI provider and the running backend. No external generation is performed by
these checks.

Verification evidence: 21 technical-analysis/focus tests and 7 existing decision
regressions passed, along with targeted ESLint and source TypeScript checks. Production
build and 390px browser component checks used an isolated local copy to avoid shared
Next.js cache conflicts. The full-project premium audit reported existing settings-page
select ownership/actionless-button and global scrollbar ownership findings; none
pointed at the new focus components. Live authenticated stock generation was not tested.

## User-selected chart models

Both chart operations require an explicit `model` ID in the request and the
signed-in user's saved API key for that model's provider. They do not consult
server model defaults or switch to server keys/fallback providers. Missing or
invalid selections and authentication failures return `503 ai_not_configured`;
the chart offers the API Keys settings link and an explicit model selector.
The selector shares the chat model catalogue and enables only user-configured
providers. Selection remains local to the chart session; opening a chart does
not automatically select a model or generate a result.

Successful payloads carry server-assigned `provider` and `model`, identifying
the API model actually requested. Both are saved with the immutable analysis
snapshot and displayed for text analysis and drawings. Older snapshots without
provenance remain readable without invented attribution. Changing the current
selector does not relabel an existing result. Cache entries are separated by
user, provider, model and a digest of the user's selected key; missing keys are
rejected before a cache lookup.
