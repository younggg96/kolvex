---
version: alpha
name: Kolvex
description: Chinese-first equity research with source-linked opinions, quiet data lists and green navigation accents.
colors:
  primary: "#00C805"
  background: "#FAFAF9"
  foreground: "#000000"
  card: "#FFFFFF"
  muted: "#F2F2F0"
  muted-foreground: "#5C5F63"
  border: "#E4E3DF"
  positive: "#008503"
  negative: "#D63A00"
typography:
  sans:
    fontFamily: "Inter, PingFang SC, Hiragino Sans GB, Microsoft YaHei, Noto Sans SC, sans-serif"
rounded:
  control: "9999px"
  row: "1rem"
  surface: "1.5rem"
spacing:
  page-mobile: "1rem"
  page-desktop: "2rem"
  section-gap: "3rem"
components:
  button: {}
  primary-navigation: {}
  market-stock: {}
  creator-opinions: {}
  report-list: {}
---

# Kolvex design system

## Overview

The product reference is the retail investing interface described in PRODUCT.md:
Robinhood-level scanability, applied to Chinese-language creator evidence and US
equities. Readers move between source opinions, published research and holdings
on desktop or phone. This is a product interface; clarity and familiar controls
take precedence over new visual effects.

The signature is a stock identifier beside its evidence and direction. Green
marks brand actions and current navigation. Do not turn the research library
into a promotional hero, decorative metric dashboard or terminal-style display.
Chinese and English are supported; no Japan-specific market scope is established.

Runtime tokens remain authoritative. This file records the existing identity;
it does not generate CSS or introduce a separate theme.

## Colors

`app/globals.css` owns semantic variables, which `tailwind.config.ts` maps to
utilities consumed by shared components. The frontmatter mirrors light-mode
values. Dark mode uses black ground, #0E0F10 cards, #FFFFFF foreground,
#9BA0A6 muted text and #282A2D borders. Primary remains #00C805 in both themes.
Use `positive` and `negative` for direction text, with a written decision label;
the primary green alone is not a small-text color on the light background.
Interaction feedback (hover, focus, press) is neutral grey, layered as a
transparent `foreground` over whatever surface it sits on. See **Interaction
feedback** for the rules.

## Typography

Inter and the established Chinese fallback stack serve headings and body text.
Research headings are 28px, growing to 32px on larger screens; navigation is
14px semibold, report identifiers 15px semibold and metadata 12px. Data uses
tabular numerals through `figure` or `tabular-nums`. Preserve Chinese line height
and allow descriptions to wrap.

## Layout

AppShell owns the viewport, desktop sidebar and mobile navigation. DashboardLayout
has no top header or duplicate page title. Optional return/actions render as an
unbordered content row only when supplied; the AI Research management action
sits beside its content heading. Mobile navigation includes a menu button to
keep sidebar routes, settings and account controls reachable. Pages retain their established content scroller and use 16px
horizontal padding on mobile and 32px from the medium breakpoint. Published
reports stay within 1080px; Creator Opinions retains a wider two-column layout.

Markets, Creator Opinions and AI Research each have one primary navigation entry.
Creator Opinions contains YouTube, Reddit and X child links in the sidebar. Each
child link carries that platform's own monochrome brand mark from
`components/common/PlatformIcons.tsx`; no two sources share a generic glyph. All
sources keep the parent active in shared desktop/mobile navigation. Below the
large breakpoint, `DashboardLayout` owns the shared `OpinionSourceNav` beneath
the header on either source and its nested routes: flat text links, a green
active underline, `aria-current` and visible keyboard focus. Source switching
uses route links rather than in-page tabs.
The stock detail route belongs to Markets. `StockLookup` at the top of Markets
uses the shared Input and Button to open any valid ticker, independently of
creator coverage. Its inline validation and clear action follow the active locale.
AI generation remains an explicit action on the stock detail page. The stock
workspace is capped at 1800px, uses the existing page gutters and presents company
identity, exchange/currency and regular/available after-hours quotes before a single
sticky horizontal Radix research tab bar. The bar scrolls horizontally on phones;
its shared `pill-solid` surface uses opaque muted fill to hide scrolling content
behind the labels, with a 16px sticky inset from the content viewport's top edge.
A single active pill slides between labels there, as it does in
`components/ui/segmented-control.tsx`, the shared iOS-style switcher behind the
in-page toggles. Selection is one continuously animated thumb rather than two
fading backgrounds: the thumb keeps the pill radius so it grows and shrinks with
the target width, glides on a `cubic-bezier(0.32, 0.72, 0.24, 1)` curve, presses
down under the finger, and is measured from the live DOM so it stays put across
reflows, font loads and horizontal scrolling. Labels never move. The control keeps
`aria-pressed` / `aria-selected` / `aria-checked` / `aria-current` for whichever
pattern the caller needs, supports roving focus with arrow, Home and End keys, and
re-measures instead of animating on first paint.
all labels remain full text. The `tab` query parameter restores the selected module
without losing the Markets return filter or legacy creator deep links. Indices retain
the chart/research modules without stock-only financial tabs.
Technicals is the first tab and the default when no valid tab or creator deep link
is supplied. Its analysis content uses the shared Card with the same 24px corners,
border, card fill and 16px mobile / 20px desktop padding as the chart surface.

Overview, Technicals and Setup share one mounted price graph,
`components/youtube/chart/PriceGraph.tsx`: a quiet line graph with no frame and no
left axis, a ~2px close line in `chart-up` green or `chart-down` orange by the
window's own change, a soft gradient area under it, a faint dashed baseline at the
price the window opened at, small numerals with the window's high and low on the
right edge, one floating tag on the peak, the latest price as a filled pill on the
axis, and three or four short date labels. Hover or touch scrubs with a dashed
guide, a dot on the line and a small date/price pill; the plot pans by drag and the
range bar's crossfade is skipped under `prefers-reduced-motion`. Creator calls stay
triangles above and below the bar (▲ bullish, ▼ bearish, · neutral, counted when a
day has several). The workspace plot is 320px on phones and 420px from sm; the
Creator Opinions preview is 260px and 320px from sm.

The graph owns its time span. A range row offers 1D, 1W, 1M, 3M, 6M, YTD, 1Y, 5Y,
and All; choosing one loads exactly that window's history rather
than trimming a fixed three-month fetch. ⌘/Ctrl + wheel and pinch zoom, horizontal
drag pans, double-click or double-tap resets, and a reset action appears only while
the view is modified. Phones stack the range row over the icon row so a long label
never hides the buttons. Clicking the plot or the single Advanced action beside the
range row opens the fullscreen chart, which shares the same chrome and range row and adds candlesticks,
volume, indicators, the KDJ/RSI/MACD subpane and saved/manual drawings on the same
visible window. The Creator Opinions page keeps its own range control only for the
opinion-strength view; the price view uses the graph's bar. AI actions live in a
collapsed disclosure below the preview; Analysis and Drawings use neutral outlined
controls. Advanced mode keeps its manual toolbar, with AI controls in a desktop side
panel or mobile popover. The desktop panel scales from 22rem to 30rem with the
viewport (28vw), keeping analysis paragraphs readable beside the plot. Drawing
overlays take dimensions and anchor mappings directly from the mounted price graph. Settings and reversible drawing visibility retain their
existing dialogs.
Advanced charts default to a KDJ (9,3,3) subpane, switchable to Wilder RSI (14)
or MACD (12,26,9). The subpane shares the price chart's time scale and inspected
bar, supports keyboard inspection and can be closed/reopened from Indicators.
Its selection persists locally. Warmup points remain missing; flat RSI is 50,
KDJ starts K/D at 50 after a full nine-bar window, and J is not clamped.
MACD uses SMA-seeded EMAs and an unscaled DIF-minus-DEA histogram. These are
price-derived displays, not generated trade signals. New manual tools include
bidirectional extended lines, one-anchor vertical time lines and two-anchor
Fibonacci projections (1, 1.272, 1.618, 2 and 2.618 times the anchored move).
They use the existing time/price anchors, undo history and per-user sync API;
both the client renderer and server validation own support for each type.
Setup content, loading and empty states use the same Card fill, border and
24px corners as Technicals, with 16px mobile / 20px desktop content padding.
Financials, Earnings, Metric trends, Target price, Profile,
News, Creators and Research show their own content directly below navigation. The
chart remains mounted but hidden for these views, preserving overlays and jobs.
Overview orders the chart, source-backed growth indicators, nine grouped financial
fact lists (one column on phones, two on medium screens, three on wide screens), then research signals.
New chart modules load on demand; visited modules stay mounted while hidden,
preserving local report frequency and metric selections. Switching tabs does not
start AI generation. The technical portal remains mounted while hidden.

Financial statements default to a chart view with a labelled Charts / List toggle.
Chart reading runs oldest to newest, with annual/quarterly and bar/line controls,
latest value and the change from the previous available report. Initial charts show
six priority metrics; Show more reveals six additional metrics at a time. Missing
observations remain gaps and negative values retain their zero baseline. Each chart
also exposes period values in a native disclosure. Charts share their implementation
with Metric trends (`multicharts` remains the compatible URL value). The list retains a semantic table, sticky first column and header,
and a keyboard-focusable scroll region; its latest column also shows the change from
the prior report. Percentage changes are omitted for zero or negative baselines,
where the absolute change remains available. View selection survives category and
frequency changes while the module is mounted. Report category and annual/quarterly controls use
labelled button groups in the same segmented style as the research tab bar: a
`bg-muted` pill container with fully rounded, equal-height segments, the selected
segment in `bg-foreground` / `text-background` (white on black, matching the active
tab) and unselected labels in `muted-foreground` with a `secondary` hover. The
Charts / List and Bars / Line controls share that exact treatment, and the CSV
action stays a neutral outlined pill beside them. Columns show actual fiscal ending dates; unsupported history
ranges and invented TTM columns do not appear. CSV exports raw numeric values,
protects text cells against formula injection and preserves missing data. Multi-metric
charts use a two-column grid on large screens and one column on phones, support
bar/line and annual/quarterly switches, and permit adding/removing metrics through
the shared authored Select and Buttons. Theme colors resolve through the existing
`rgb(var(--...))` runtime tokens; chart marks use the text-safe positive color in
both themes. EPS actuals and estimates have named legends and an accompanying table. Earnings
bars show a Beat / Miss / Met label and small downward pointer above the higher
bar in each reported pair. Hover/tap details retain source dates, estimated EPS,
reported EPS and the absolute difference in the supplied currency. The history
table repeats the outcome and delta; missing actuals or estimates have no outcome.
Markers are computed from reported EPS versus estimates (including losses and zero),
not inferred from source surprise percentages. The chart reserves headroom for
labels and scrolls horizontally on narrow screens to keep labels readable.
Free research data uses SEC EDGAR and the existing Yahoo provider only; nothing here
calls a paid service. Financials adds a Statements / Long-term, TTM & ratios switch:
the long-term view reads SEC company facts, keeps a real TTM column only when four
contiguous quarters connect, marks derived cells with `*` and links each date to the
filing. Earnings adds current revenue consensus and SEC filings, with 8-K Item 2.02
marking earnings releases; past revenue beat/miss, transcripts and slides have no
reliable free source and say so rather than being inferred. Peers compares up to four
user-chosen companies on one provider's definitions, restored from the `peers` query
parameter. Series color follows the company and removing one never repaints the rest;
S&P 500 stays a dashed neutral line. P/S and EV/EBITDA are hidden when listing and
reporting currencies differ, because the source's ratio mixes them. Ownership shows
Form 4 trades and a curated list of 13F investors; totals count only open-market
codes P and S, and a failed 13F name match is worded as "no name match", never "not held".
Analyst target differences are relative to the source-supplied price and are labelled
as estimates, with no claim that the stock is objectively undervalued. The target
section pairs a price-range visualization (reference and mean markers, explicit
low/high endpoints) with horizontal rating-share bars. Analyst coverage and rating
sample size retain distinct labels. Company descriptions and stock source notes
use the full available content width, without a prose-width cap. Stock chart tooltips
use a subtle theme-colored cursor; tab selection uses the green underline, while
keyboard focus adds a quiet background and text underline rather than a green box.

All modules retain localized loading, empty, retry and partial-data states. Missing
numbers use an em dash and missing values are not converted to zero. Market currency
and available financial reporting currency are distinguished. Profile source links
accept only HTTP(S). Existing news, creator, research, holdings and AI history behavior
remains available. Repeated headings inside the news, creator and research panels
remain visually hidden but available to screen readers. Active panels retain the
existing short transition and global reduced-motion behavior. Shared typography,
light/dark themes and controls retain the Kolvex identity.

Creator Opinions shows the first
10 filtered stocks with a full stock directory at `/dashboard/youtube-opinions/stocks`.
The count shows displayed/filtered totals. When more stocks match, View all links
beside the count and below the preview open that directory with search, sentiment,
scope and sort preserved. The full directory starts at 40 rows and loads 40 more
per explicit action.
Both directory tabs render one canonical list card (see **Canonical list cards**)
below the page heading and search. Tone pills lead the card; the search and the
sort Select share the next row; the displayed/filtered count, the list rule and one
column header precede 80px hover rows without per-row dividers. Creator rows keep
the avatar, name, handle and last-updated date on the identity side and the
qualitative consensus with the opinion count on the end side; stock rows keep the
price column, creator count and their labelled disclosure. The right rail's
latest-video and holdings modules use the same card bodies below their headings,
with their view-all links as top-divided footers. Recent opinion changes follows
the directory as another list card. Controls keep 40px minimum height and existing
URL state; light, dark, phone and wide layouts share the same anatomy.
Creator detail pages show the creator’s five latest individual opinions across
all dates, with a View all opinions button that clears history filters and focuses
the full opinion history below. They order latest opinions, opinion history, then most
discussed stocks in one reading column on all screen sizes. The stock list sorts
by opinion count, initially shows at most five stocks, and offers a labelled
expansion to the full searchable list and a collapse action.
Stock and creator detail pages use the Markets card language. The trend view
controls sit above the chart: the price / opinion-strength switch on the start side
and the shared range pills in one muted track on the end side. The price chart and
its AI drawing and analysis results render in separate 24px cards below that
control row, followed by the opinion distribution card and the opinion history
card, with 24px gaps. Drawing and analysis results are portalled out of the chart
component into the second card, so the chart card keeps the same shape and height
as the Markets chart card; the AI results card stacks the written analysis first,
then the drawing detail disclosure and the saved analysis history, and hides its
top divider. The creator rail that lists who discusses the stock is one card body
below its heading, with 16px row corners, a 320px rail width, and the last-updated
date under the creator handle so names keep their width. The opinion distribution
card removes its own top padding because the card body supplies it. Controls and
loading, empty, error and retry states keep their existing behavior.

Recent opinion changes follow the directory in the left column. Its right rail
orders latest creator videos and my holdings. The video preview shows at most five
different creators, one newest imported video per creator, ordered by publication
time. All stock opinions from the same video form one group before preview selection
or pagination. `VideoOpinionCard` owns both the compact rail (two stock summaries
initially) and the full list (three initially), with explicit expansion, creator
attribution and source links. The section links to `/dashboard/youtube-opinions/opinions`,
which pages 20 complete videos at a time, ordered by publication time, with a displayed/total
video count and retryable Load more. Imported videos with no stock opinions retain
their creator and video analysis, display an analyzed status, and remain visible
when untracked uploads are hidden. They do not render a stock row or affect stock
sentiment counts. The complete list retains older videos from
the same creator. No opinion is discarded to diversify the preview. Updates
remains accessible by legacy URL but has no primary navigation tab. Legacy Research URLs redirect
to the appropriate entry so refresh and saved links keep working.

AI Research detail pages lead with the existing final conclusion, then the
investment plan, analyst evidence and supporting debate. The reading area uses
16px body text on mobile and 17px on desktop, line height 1.85 and full available
reading-column width (`w-full min-w-0 max-w-none` overrides Typography's default cap).
Markdown titles are subordinate to the stock heading; major sections use quiet
top dividers, numbered lists retain visible markers, and tables scroll within
keyboard-focusable bordered regions. Paragraphs
and sections have distinct spacing. Desktop gets a sticky section directory;
mobile uses a horizontal text directory. Analyst tabs stay visible as words,
separate from article actions. Debate verdicts precede native disclosures whose
expanded text follows document flow, without nested vertical scrolling. Both
published and completed authoring reports use `ResearchReportContent`.
Report and debate actions show a labelled Translate / Original toggle; verdicts
also expose it beside their heading. Translation uses the existing API, retains
the original on failure with an inline retry hint, and resets when source content
or the target language changes.

## Elevation & Depth

Reading surfaces are flat with quiet border separators. Hover adds the existing
muted fill. Reserve `surface-overlay` shadows and dark borders for popovers and
dialogs; research navigation and static lists do not require elevation.

## Shapes

Shared Buttons and primary sidebar selections are pills. Published AI Research
reports use 12px cards with a quiet border and no static shadow, arranged in one
column on phones, two from the small breakpoint and three from the large
breakpoint. Each card links to its report and groups stock/direction above author
and report metadata. Route navigation uses an underline and otherwise stays flat.

## Components

Stock identity always pairs a company logo with its ticker in structured stock
references. `components/ui/company-logo.tsx` owns logo loading, its white image
surface and the symbol fallback. Every company logo and its symbol fallback renders
as a circle; the former 22% rounded-square shape is retired. Use at least the
32px `sm` size for stock tags and opinion identities. `components/ui/stock-badge.tsx` owns the bordered,
wrapping logo/ticker link used by event calendars, daily briefs and X cashtags;
calendar badges sit above the event title, separately from source attribution.
Every company in a multi-stock event gets its own badge. Existing stock lists
and detail headings retain their shared logo treatment. Broad market events
without tickers do not invent a company identity.

Markets' stock observation list uses the existing flat rows, pill Buttons and
Radix Selects inside one rounded card body. Core US stocks and Creator activity select the stock universe;
The shared Input searches the current list by ticker or company name, accepting
an optional dollar prefix. Search leads the toolbar, followed by labelled sector
and sort Selects; on phones search spans the first row. Removable filter buttons
and Reset filters preserve the current scope and restore the first ten rows.
Rows show identity and signed daily price change at every width, without a
separate creator link below each item. Below 400px the decorative sparkline
yields space to identity and price. The Watchlist star sits inside the same
rounded row background as the stock identity, trend and quote; hover and keyboard
focus highlight the whole row. It remains a separate 44px button beside the detail
link, so saving never opens the stock. The aligned Watch / 自选 heading identifies
the action column. Use ten-row Load more increments,
explicit loading/error/empty states, and the existing semantic theme tokens.
Market list state belongs to URL query parameters; local storage remembers the
last scope/filter/sort, excluding search. Search is URL state, applies before
pagination, and waits for IME composition to finish. Clear returns focus to the
search input. No-results offers Reset filters. Details retain a validated market
return link including the active search.

Creator stock directory rows retain the flat separators and existing semantic
colors. `StockDirectoryRow` defaults to a compact overview: stock identity,
latest price, today's move, historical consensus and evidence count, followed by
one truncated reason and a labelled Expand/Collapse control. The overview link
and disclosure button are separate keyboard targets. Each row independently
expands through the shared Radix Collapsible, revealing the full attributed
reason, dated price periods, 30-day creator distribution, dated opinion change,
7-day heat and the source link.
Expanded content stays in document flow and long reasons remain readable.
`OpinionChange` and `StockDirectoryContext` own these evidence treatments; qualitative
direction continues to use `OpinionStrength`. Data periods and limits are defined
in `../docs/decision-workspace.md`. No new palette, type family or surface effect
is introduced.

| Visual role | Runtime owner | Adapter and consumers |
|---|---|---|
| Semantic colors and themes | `app/globals.css` | `tailwind.config.ts` → shared UI and research views |
| Font stack | `tailwind.config.ts` | `font-sans`, `font-display`; global body sizing in CSS |
| Buttons and focus | `components/ui/button.tsx` | Pill variants; neutral navigation actions use `asChild` links |
| AI Research routes | `lib/researchRoutes.ts` | AI Research list, authoring and report return links |
| Route navigation | `components/layout/navItems.ts` | Markets, Creator Opinions and AI Research; `aria-current`, visible keyboard focus |
| Opinion source links | `components/layout/OpinionSourceNav.tsx`, `navItems.ts` and `components/common/PlatformIcons.tsx` | Sidebar child links with per-platform brand marks; shared mobile source row in `DashboardLayout` |
| In-page tabs | `components/ui/tabs.tsx` | Radix tabs for peer report panels; not a replacement for route links |
| Loading and data states | `components/ui/skeleton.tsx` and the owning list | Existing skeleton geometry, explicit empty/error states and retry |
| Scrollbars | `app/globals.css` | Global standards properties and WebKit fallback; new scrollers need no opt-in class |

Detail-page return navigation lives in `DashboardLayout.headerLeftAction` and uses
`components/layout/HeaderBackButton.tsx`: a ghost icon button with only a Lucide
arrow, a translated accessible label and tooltip, and the existing return target.
Keep it available in loading and missing-report states.

The stock workspace places that same return control at the right of the stock
identity row, per the requested layout. Its `PriceChart` workspace variant reserves
360px for the plot on phones and `clamp(480px, 60vh, 760px)` from the small breakpoint,
including loading and error states. Creator-opinion compact charts and the advanced
dialog retain their existing sizing. The page retains natural content scrolling.

Reddit rankings use a short 24/32px heading, an icon-only Refresh button with a
localized accessible label, and the shared search Input. The page scroller uses
`bg-background` to cover the shell's decorative grid. Below md, flat native
`details` rows show rank, the shared 32px company logo, ticker, truncated company
name and right-aligned mentions with signed percentage change beneath. Touch or
keyboard expansion reveals the full name, rank movement and upvotes. From md,
the full shared Table retains its quiet 12px bordered container and labelled
keyboard-focusable horizontal scroll region. Activity stays neutral in color.
Keep the ApeWisdom methodology link and actual fetch date/time in a compact
footer, with retry and distinct empty/search-empty states in document flow.
Repeated descriptions, coverage counts and explanatory notes are omitted.

Lucide outline icons accompany visible labels except for these return controls and
the monochrome platform brand marks on opinion-source links. Hover/focus must
reveal no otherwise inaccessible actions. Global reduced-motion rules apply to
existing page animations. Report data and author attribution come from the API;
missing reports get an empty state, never invented content. The behavioral
companion is `../docs/decision-workspace.md`.

Stock-page Creator Intelligence is owned by
`components/decision/CreatorIntelligence.tsx`. Three quiet bordered cards group
the latest creator calls into bullish, neutral or mixed, and bearish. They retain
the existing 12px card shape, semantic positive/negative direction colors and
muted neutral treatment; each group also has a written label and creator count.
The cards form three columns only when their content container reaches 42rem,
and stack below that width. Creator rows show real attribution, date and a short
preview; each group initially shows three creators with an explicit expansion
control.

A horizontally scrollable date timeline follows the cards, with wrapping creator
chips for the selected day and an inline reading region below. Selection uses
muted fills, a border and pressed state rather than color alone. The reader keeps
full opinion text in document flow with a 72ch maximum measure, including supplied
supporting points and risks. Card selection focuses and reveals that region;
timeline and chip buttons retain visible keyboard focus. Loading preserves the
card geometry, errors offer retry, and empty groups and missing stock opinions
have explicit translated messages. Preserve the existing Inter/Chinese stack
and theme tokens throughout this component.

### Authentication

Login, signup, forgotten password and reset password share the existing theme,
Inter/Chinese stack and one flat bordered card. `AuthLayout` centers a reading
column capped at 440px, with 16px outer horizontal space and 24px card padding
on phones, increasing card padding to 32px from the small breakpoint. The card
has 12px corners and no static shadow. Its heading is 30px semibold; supporting
copy is 14px with 24px line height. The page scrolls with the document, and the
localized heading also supplies the browser title. Authentication retains
BaseLayout's animated grid background and its reduced-motion fallback.
`auth.css` disables only the form's entry animation; runtime tokens remain the
color authority.

**The Shared Auth Controls Rule.** Auth forms use the shared Input's `auth`
variant for aligned 48px controls with 12px corners, semantic borders, muted
fill, 16px text and visible focus. Password visibility augments this same Input.
Shared pill Buttons provide full-width primary and outline actions; shared Radix
tabs provide two equal underlined login/signup choices with visible keyboard
focus. Labels, hints, validation messages and status copy follow the active
Chinese or English locale. Invalid fields expose their associated description
and semantic negative border; submission focuses the first invalid field.

#### Canonical UI Map for authentication

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Input/Text field | `components/ui/input.tsx` | Runtime semantic tokens and shared Input | Default; `auth` for 48px authentication fields | Captured light/dark layouts and empty-form focus/errors; invalid border uses `aria-[invalid=true]` selectors |
| Password visibility | `components/ui/password-input.tsx` | Shared Input and `lib/i18n/locales/{zh,en}.json` | Same Input variants; localized show/hide button | Keyboard Enter toggles type and accessible name; preserves autocomplete and paste |
| Tabs | `components/ui/tabs.tsx` | Shared Radix tabs | Default scrolling list; `auth` two-column list without scroll clipping | ArrowLeft/ArrowRight mode switching and visible focus |
| Label/Button | `components/ui/label.tsx`; `components/ui/button.tsx` | Shared label and pill button variants | Auth uses labelled fields and large primary/outline actions | Captured alignment and keyboard focus |
| Field descriptions, validation and feedback | `components/auth/AuthUI.tsx` with the owning form | Locale messages and local form state | Field hint/error; alert/status; busy submit; recovery back link | Empty login/signup/recovery and invalid reset captured; API busy/success/failure presentation checked in source |
| Auth shell | `components/auth/AuthLayout.tsx` | Runtime theme; localized route title/subtitle | Login/signup at `/auth`; `/auth/forgot-password`; `/auth/reset-password` | Desktop/light and 390px mobile/dark captures; document width and scrolling |

The presentation retains the backend-defined six-character password minimum
and existing authentication services and redirect handling. Browser verification
covered local validation and the invalid recovery-link state; it did not complete
real sign-in, account creation, OAuth, reset-email delivery or password updates.
The valid reset form and service result states were checked in source. English
copy was checked statically, without an English runtime capture.

## Do's and Don'ts

- Keep creator discovery and the former Research overview within Creator Opinions.
- Keep published reports under AI Research and the stock detail route under Markets.
- Reuse semantic theme tokens, translated labels and shared UI primitives.
- Preserve administrator-only authoring and existing backend access checks.
- Do not restore the former Research or Deep Research navigation entries.
- The stock workspace offers user-requested shared AI analysis generation and version history. The public report library retains its reading workflow.

## Stock analysis history

Creator opinions use `America/New_York` calendar dates across cards, filters,
daily summaries and price-chart annotations. `lib/opinionDates.ts` owns their
display formatting; date-only values remain calendar labels in every viewer's
timezone. The backend verifies imported YouTube publication instants against
the YouTube Data API, stores the UTC instant, and derives `opinion_date` in New
York. Admin publication edits use New York calendar dates and preserve the full
original timestamp when unchanged.

`CreatorShare` adds one Share action beside the creator profile action. Its
shared Radix dialog opens on Link & social: copy the public link or complete
share text, open X/Facebook/WhatsApp/email composers, or explicitly invoke the
native share menu. `/share/creators/[channelId]` reads the same public latest-video
API without forwarding reader credentials and shows every stock summary without
requiring sign-in. The link follows the newest imported video, independently of
screen filters and pagination; publication remains the reader's explicit action.
Image is a tab inside this same flow; canvas/fonts load only when selected.
`lib/creatorShareImage.ts` draws
1080px-wide PNGs with content-fitted height up to 1440px using a snapshot of the preview's inherited CSS color tokens,
computed website font family and `rounded-xl` radius. `app/globals.css` remains
the color owner, including light and dark themes; the renderer maintains no
separate palette. `lib/brandAssets.ts` owns the candlestick path and existing
logo color consumed by both `LogoIcon` and the renderer. The image shares the
website's Kolvex wordmark, flat bordered card and row separators, and calls
`describeStrength` for the same translated label and three-step meter as
`OpinionStrength`. Theme changes invalidate and regenerate the preview.
Full summaries continue
onto numbered pages; opinions that fit on a new page remain together. Source
title and link remain visible. Every image includes the creator's circular avatar
beside the name/date; unavailable avatars use the name initial. The existing
same-origin image proxy owns YouTube CDN loading for canvas export. The preview
and loading region share a viewport-bounded frame (45dvh, up to 440px), with the
complete image contained inside it. Card and footer height follow the content so
short pages do not retain a large blank area. Desktop and mobile readers can save each
image, while supported devices can explicitly open native file sharing. PNGs
are prepared before the share click and remain local; object URLs are revoked
on page changes and close. Empty/error/retry states retain the same dialog.

`components/decision/AnalysisHistory.tsx` owns the shared dated version list,
pagination, current marker, historical-view notice, retry and current-version
switching for both technical analysis and shared research. Its `useStockHistory`
hook owns cancellable loads and conflict recovery. Existing Buttons and native
disclosures retain the established colors, shapes and keyboard behavior.

`PriceChart` reads saved technical snapshots and derives AI drawings from their
original coordinates. Historical viewing uses captured OHLCV bars and does not
write the chart-drawing store or the current-version pointer. Manual drawings
retain their existing sync. Personal research uses the existing background job
API; completed reports are snapshotted in the database, and the existing shared
`ResearchReportContent` renders complete saved reports. Missing technical,
fundamental and news analysis offers an explicit generation action. Generation
happens only after a click, saves a new version and preserves older versions.

AI chart actions are separate: **AI analysis** produces written interpretation
and requested technical findings; **AI drawings** produces chart overlays only.
`PriceChart` owns independent selected/current snapshots for `technical` and
`drawings`. Updating, clearing or restoring one channel preserves the other.
Both compact and advanced charts show the two explicitly labelled buttons;
analysis focus controls apply to the text action. Each channel has separate
history controls and its own current-version marker.

AI drawings expose the shared `DrawingVersionSelector` in both charts' AI control
regions, using the authored Select. Options show saved time, model and the current
marker. Generation retains immutable older versions; viewing does not change the
saved current pointer. Loading older versions preserves the viewed version.
Hide only removes overlays from view; selecting any saved version restores them,
including the same version. Returning to current and setting a historical version
as current remain explicit actions. Text analysis retains its history disclosure.


AI analysis focus uses a single disclosure row with a preview of selected topics.
Expanded controls use the shared Checkbox in a flat two-column mobile/four-column
wide grid. Optional scenario entry appears only after Add scenario; limited-data
categories live under More categories with an explicit availability note. The
written result leads with its summary, then a Technical evidence disclosure;
unavailable standard topics share one notice. Preserve the existing theme tokens,
keyboard focus and Inter/Chinese typography rather than adding colored topic pills.

Chart focus controls use `TechnicalFocusSelector` dialogs for written analysis and
AI drawings separately. Opening copies the saved selection into a draft; confirm
applies it, while cancel, Escape and dismissal discard it. Checkboxes wrap into
two columns on phones and three on desktop. Changing focus takes effect only on
the next generation, preserving saved results. Drawing categories include levels,
trendlines, candidate Elliott counts, computed EMA paths, detected chart and
candlestick patterns, and Fibonacci. Wave counts remain explicitly tentative;
missing detections show an unavailable state. Annotation dates and prices belong
to the saved drawing version; EMA paths render as a single polyline rather than
hundreds of editable segments.

Chart AI analysis and drawings require an explicit selection from the shared
`lib/aiModels.ts` catalogue and the user's own configured provider key. The
chart uses the shared Radix Select and offers API Keys settings when configuration
is missing or invalid. No server model or key fallback is allowed. Result
metadata shows the provider and API model from the saved snapshot; changing the
selector never changes attribution on an existing result. Legacy snapshots with
no model metadata omit attribution.

AI drawing focus also includes conditional entry/stop/target plans. The chart
marks entry at the range midpoint, stop-loss and each target; `AiDrawingSetup`
shows the full range, conditional reason and reward-to-risk ratio beneath it.
The server validates direction and price ordering and computes the ratio from
the entry midpoint and nearest target. Display reward : risk (e.g. 1.50 : 1).
Invalid or neutral setups produce no plan overlays and an unavailable finding.
These fields remain in the immutable saved drawing payload.

Drawing and analysis selectors expose breakout/breakdown, retest and false-break
categories. `AiPriceActionSignals` lists dated events and their reference prices
in document flow below the chart; labels explicitly distinguish pending,
confirmed, failed and unconfirmed breaks. Detection uses swing levels confirmed
before the event, tolerance from preceding candles, two consecutive closes for
confirmation, a ten-bar retest window and a five-bar failed-break window. Wick
rejection is separate from a close crossing. These are declared detection rules,
not a guarantee that a future break or retest will occur.

## Chart controls and result reading

`ChartView` places the primary AI analysis and secondary AI drawings actions
first, with a quiet AI settings action aligned right. Phones keep the two
generation actions and icon settings action on one row with 44px minimum touch
targets. Desktop uses compact 36px controls. The shared Radix dialog's `sheet`
variant anchors settings to the phone's bottom safe area and centers it on
desktop; only its body scrolls, keeping the close action reachable. It contains the model selector and
`PriceChart`'s analysis/drawing tabs. `TechnicalFocusSelector` reuses its topic
editor inline in each tab, with immediate settings updates for the next generation;
its standalone dialog variant retains draft/apply/cancel behavior. Saved drawing
versions appear inside the drawing tab. No model field, focus summary rows or
version dropdown sit above the chart. Common focus topics stay visible; more
technical topics use a native disclosure that shows the selected count. On phones,
manual drawing tools use a labelled popover, color selection uses a swatch popover,
and zoom/edit actions occupy a second row without overflowing the page.
Selecting generation before choosing a model opens settings, with guidance
and the API Keys settings link inside the settings dialog. The shared authored
Select owns keyboard selection and a trigger-width, height-bounded popup.

`useChartAiJobs` in `PriceChart` owns background job state shared by compact and
fullscreen charts. Queued/running status and safe localized errors appear beside
the AI controls; the fullscreen mobile status remains visible outside its AI
popover. Status failures offer Check status rather than another generation.
Pending jobs disable duplicate generation, survive navigation and resume polling
on return. A successful job reloads the saved version; failure retains the previous
saved analysis and drawing pointers. Uncertain submission retries reuse the same
idempotency key. No task runs simply by opening the chart.

The advanced chart uses the shared `DialogContent` fullscreen layout variant.
Its visible title and translated close action occupy a compact fixed header.
The fullscreen body never scrolls: the chart fills the remaining viewport height,
with quote/OHLC data and drawing tools above it and time controls below. AI model,
actions, focus settings and results share a 288px right rail on desktop; only
that rail scrolls. Below the desktop breakpoint, AI controls and results open
from a translated toolbar action in a bounded popover. Nested focus dialogs retain their existing draft,
confirmation and Escape behavior. Default dialog geometry is unchanged.

Written analysis leads with trend, direction and a 16px/28px conclusion.
`AnalysisSummary` is shared with the stock technical section: long conclusions
show four lines with an explicit expansion action that retains the full text.
Invalidation remains visible, followed by key prices; price explanations,
technical findings and indicator/trendline details use native disclosures.
Secondary actions follow the report rather than competing with its heading.
Conditional drawing plans lead with the entry range, stop, targets and ratio in
a wrapping data strip. Their full rationale and signal detection rules expand
in document flow. Body explanations use 14px/28px text and a 72ch maximum
measure; metadata uses 12px/20px. Existing content, attribution, saved history,
theme tokens and Chinese/English messages remain authoritative.

### Canonical UI Map for chart analysis

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Select/Listbox | `components/ui/select.tsx` | DESIGN.md; `lib/aiModels.ts` catalogue | Authored Radix model and interval selectors | Browser keyboard, popup width, collision and bounded scrolling |
| Overlay | `components/ui/dialog.tsx` | DESIGN.md; `PriceChart` and focus draft behavior | Default dialog; fullscreen chart; mobile sheet/desktop dialog for AI settings | Browser nested Escape, close, focus restoration and narrow layout |
| Disclosure | Native details; `AnalysisSummary` | Saved analysis payload | Technical evidence, plan rationale and full conclusion | Browser expand/collapse and long content |

## Marketing landing page

The homepage uses the same visual system as the dashboard, with a larger
marketing composition and its existing animation layer. `components/landing/landing.css`
only aliases the runtime `background`, `card`, `foreground`, `muted-foreground`,
`border`, `muted`, `primary` and `positive` tokens from `app/globals.css`.
It has no independent palette or dark-mode color overrides. Theme changes follow
the dashboard automatically. Header, footer and the subtle background grid use
the same neutral surfaces as the application. Inter/Chinese typography remains
shared; homepage display headings retain their larger scale with 600 weight
and restrained tracking.

The asymmetric hero pairs a two-line headline with an interactive illustrative
price chart and opinion/research/holding nodes. The single ambient composition
communicates that these sources connect to the same stock. Stock buttons change
the example chart; its values are explicitly illustrative. A pause button stops
ambient movement and pointer tilt. Source-based evidence, no fabricated creators,
customer counts or performance claims, remains the marketing content rule.

`LandingMotion` owns shared reveal timing. Motion is isolated in client components:
chart entry and a traveling signal, pointer tilt and scroll parallax using motion
values, section reveals, and feature/tab
transitions. Native scrolling remains in control. Reduced motion removes movement
and preserves content; narrow screens use a single column.

The stock research dossier replaces the repeated price chart in the preview.
A vertical shared Radix Tabs list switches between creator opinions, technical
analysis and AI research. Each reading panel groups illustrative reasoning, a
counterpoint or invalidation condition, and a follow-up question; it makes no
live-data or source-attribution claim. The bordered sidebar and reading column
stack on phones. Shared Radix Tabs own preview keyboard navigation.
Feature disclosures use buttons with expanded state
and corresponding regions. Existing route targets, section anchors, navigation
labels, logo, footer/legal content and global application tokens are preserved.
Buttons use the shared pill variants, including their colors and hover/pressed
feedback. Example panels and content nodes use the dashboard’s 12px corners and
quiet borders without static shadows. Marketing layers are base 0, content 1,
diagram notes 2, header 20.

### Landing motion coverage

`LandingMotionProvider` is the homepage-only motion owner. It coordinates the
existing scene pause control, system reduced-motion preference and finite
IntersectionObserver/Web Animations entrances for header, source notes, feature
links, dossier sidebar, workflow rows, closing actions and footer. HTML remains
visible before hydration and without animation support. Each entrance plays once;
small sibling delays are capped at 195ms. `LandingReveal` uses a bounded crop for
large example frames and short arrivals for headings. The illustrative chart is
the focal sequence; its ambient signal stops offscreen and in hidden tabs.
Dossier evidence follows reading order when its tab changes; workflow nodes and
connectors arrive in source-to-context order. Hover, focus and pressed feedback
use the same short easing and preserve native semantics. Pausing removes spatial
feedback and settles the composition; reduced motion retains visible state and
content. No additional dependencies or animation of document scroll ownership.

## Stock research reading

Stock detail research reuses `ReportCard` for the investment thesis, evidence and
bull/bear discussion. The same translation hook, visible Translate/Show original
action and inline failure recovery apply to published and saved versions.
Translations are requested explicitly, keyed to source content and locale, and
never replace the saved report. Evidence is arranged vertically so long Chinese
and English reports retain a comfortable measure on desktop and phone.
`components/trading-analysis/markdown.tsx` owns report typography: 72ch maximum
measure, 1.85 line height, separated paragraphs, semantic Markdown headings,
lists, emphasis and horizontally scrollable tables/code. It uses the existing
global theme tokens and font stack.

## Creator detail loading

Creator Opinions keeps the current page readable while preparing an internal
detail navigation, then commits the route and its data together. A compact
status sits above the content without moving it. Cold loads use the existing
Loader2/status treatment rather than large skeleton blocks; missing creator
names use a localized page label, never a raw channel ID.
`lib/youtubeOpinionsApi.ts` owns a bounded 30-second in-memory dashboard cache
and concurrent-request reuse. Context and first-page opinions share a request
when their filters match. Refresh and successful admin edits invalidate it;
failed requests are not cached and requests time out after 20 seconds.

## Daily Briefs

Daily Briefs is a primary route at `/dashboard/briefs`, shared by the desktop
sidebar and mobile navigation. Primary navigation follows Markets / 行情, Daily Briefs / 日报, News / 新闻,
KOL Opinions / KOL 观点, then Research / 研究 on desktop and mobile. Mobile
retains its menu control; Portfolio remains excluded from the mobile tabs. The route is readable by signed-in
users; only administrators import content. Importing makes the issue visible
immediately, as requested in the reader-flow extension.

The reader uses the existing 1080px reading width, 16/32px page padding,
Inter/Chinese stack and semantic light/dark tokens. It renders the selected
issue's full `BriefContent` immediately, with no summary card or read-more step.
Supplied image credits remain visible; no new design tokens are introduced.

Shared Radix Tabs owns pre-market/intraday/post-market selection and keyboard navigation. There
is no All tab. Opening without an explicit edition chooses pre-market before
06:30 America/Los_Angeles, intraday until 14:00 and post-market thereafter, including weekends;
this is an editorial time rule, not an exchange holiday/early-close schedule.
Explicit type/date URL selection always wins. The reader requests the unique
`{type}-{date}` detail directly, and a missing issue shows an edition-specific
empty state without switching to another date or edition. Legacy article URLs
remain supported; Admin import and preview share the three-edition contract.
`BriefContent` owns the article in both admin preview and the reader, and
`BriefImage` owns images, captions, credit links and failed-image placeholders.
Long text wraps; article disclosures remain in document flow.

`useBriefData` owns bounded, cancellable reads, stale-response protection and
focus/reconnection refresh. Loading uses the existing Loader2/status treatment.
Empty, missing, expired-session and retryable error states are localized.
Imported article text remains in its source language. `app/globals.css` remains
the theme and scrollbar owner; the page's established content scroller owns
vertical scrolling.

### Brief calendar

The date button opens the monthly calendar in the shared Radix Popover.
It is closed initially on desktop and phones; selection closes it and restores
focus to the trigger. Escape and outside click dismiss it. Collision-aware
placement and bounded internal scrolling keep the popup within the viewport. The introductory sentence and
import action are absent from the reader, per the follow-up request. Importing
remains in Admin. Calendar owns dates, not financial events or a generated
market schedule.

`components/ui/calendar.tsx` (React Day Picker) owns date-grid keyboard behavior.
`BriefCalendar` is its editorial variant: localized months/weekdays/labels,
Pacific today, filled circle/square/outlined circle pre-market/intraday/post-market markers and matching accessible
day labels. Selected dates use existing foreground/background tokens for contrast.
The calendar queries only its displayed month, at most 93 issue records. Marker
loading/failure has its own retry without blocking reading.

`date=YYYY-MM-DD` and `type=morning|intraday|evening` live in URLs; date and edition
changes retain the other choice. Opening without a valid date selects today
in America/Los_Angeles and requests only that date’s selected edition. Empty days show an empty
state, never an older latest issue. There is no All dates mode. Today returns
to the current Pacific date; previous/next day cross month and year boundaries.
Dates remain calendar labels in every reader timezone.


## Public research reading

The anonymous content library lives at `/research`, `/research/[id]`, `/creators`,
`/stocks` and `/stocks/[ticker]`. Existing `/share/creators/[channelId]` URLs remain
canonical for each creator's latest imported video; no competing creator detail
URL is introduced. Homepage research links lead to these public reading routes.
Authenticated authoring, portfolios, accounts and daily briefs keep their existing
access rules.

Public library copy is Chinese-first, with `lang="zh-CN"` on its reading shell;
report bodies retain their supplied language. The shell has crawlable text
navigation, document scrolling, 16/32px padding, 1120px outer width and the
existing shared Button, logo and semantic light/dark tokens. Stock identifiers,
source names and New York opinion dates carry hierarchy; no promotional metrics
or independent color palette are introduced. Report bodies reuse `MarkdownBody`.
All supplied report sections appear in server HTML, including native discussion
disclosures. Public pages do not request translations or trigger AI generation.

Lists use 20-item numbered URL pages with real previous/next links, explicit
empty states and retryable route errors. Navigation waits for server content
without a streaming loading boundary so missing pages retain real HTTP 404 status. Each page has its own
canonical URL. Missing and unpublished reports return not-found; backend failures
remain errors. Publication is checked on every request without persistent content
caching. Dynamic sitemap discovery reads public endpoints only, includes all
published report batches and public opinion directories, and fails visibly if
its data source fails. Full access and testing details live in
`../docs/public-reading.md`.



### Public directory motion

`ReadingMotion` and `components/public/reading-motion.css` add progressive
animation to `/research`, `/creators` and `/stocks`. The existing reading layout,
font stack, colors and card recipes remain authoritative. Headings and list items
enter once per route or URL page with a 500ms opacity and 12px upward reveal;
visible items stagger by 40ms, capped at 160ms. An IntersectionObserver reveals
later items as they enter, with at most 150ms stagger per batch. No scroll handler,
new animation dependency, data request or layout sizing is introduced.

On fine pointers, report cards lift 4px and their logos scale to 1.06; directory
rows and their arrow move 4px. Press feedback uses scale .99, while header and
pagination controls use .97. The navigation underline grows from its leading
edge. All motion uses the existing `--ease-out-quint` token, with 300ms color
transitions and 500ms transforms. Hover movement is disabled on touch devices.
Keyboard focus remains visible and immediately reveals its target. Reduced motion,
print, absent browser APIs and JavaScript-disabled reading retain visible content;
active animations and observers are cleaned up on navigation. No fonts or
heading gradients are added by this motion update.

### Public and workspace presentation parity

Public reading uses the workspace's 28/32px headings, 15px directory identifiers,
12px metadata, 16/32px page padding and semantic surfaces. The public header uses
the same compact header rhythm, shared theme toggle and pill Buttons, with active
underline route navigation; it retains document scrolling and anonymous access.

`ResearchSummaryCard` owns report presentation in both `PublishedResearch` and
public `ResearchList`: company logo and decision above author/date metadata,
12px corners, quiet border and no static shadow. Public lists use the same
one/two/three-column breakpoints. Related reports in a stock sidebar use the
single-column variant of that same card. `ReadingDirectories` reuses the canonical
list card (`components/ui/list-card.tsx`) for public stock and creator
directories, and `ReadingElements` uses it for public opinion feeds, keeping the
creator avatar, company logo and reading measure.

`StrengthIndicator` owns the qualitative word/meter presentation. The existing
`OpinionStrength` supplies the active workspace translation; public reading
supplies its documented fixed Chinese copy. Stock opinion rows and creator share
pages reuse that presentation, avatar sizes, 15px/28px text and source-video icon.
Creator shares use `ReadingLayout`, preserving their existing sharing actions.

`reader-styles.ts` owns the report grid, conclusion panel and directory-link
recipes for public reports and `ResearchReportContent`. Public report bodies keep
all evidence in server HTML while matching the workspace's sticky desktop
contents, horizontally scrolling mobile contents, conclusion surface and shared
`MarkdownBody` typography. Access rules, content, URLs and SEO metadata stay under
their existing owners; visual parity does not introduce authenticated app shell
providers or hide the public body behind tabs.


## News terminal

`/dashboard/news` is a single-column reading feed. DashboardLayout renders its
inline action row: delayed-headline notice, update status, pause/resume and refresh.
Date separators and local timestamps introduce plain headline links. There are
no row actions, bookmarks, source tags, category rails, search, Focus rules,
details panes/drawers or related-symbol chips.

Headlines follow the active application locale automatically. English uses the
English RSS source; Chinese translates the displayed rows without a manual
button. `useNewsTranslations` reuses the existing `translateText` client/API,
limits concurrency to three, deduplicates title text and retains up to 1000
translations in memory. Switching language or correcting source text cancels
outdated work. A pass times out after 45 seconds. Pending/failed translations
retain readable originals; one page status and retry action handles failures.
Translations are display-only and never replace the source article.

Shared pill Buttons, Inter/Chinese typography, semantic themes and the existing
content scroller remain canonical. Feed updates stay buffered behind an explicit
reveal button. Rendering starts at 40 rows and expands explicitly; only displayed
rows are translated. The source remains documented in `../docs/news-feed.md`.


## Public landing page

The public `/` surface uses `components/pages/HomePageClient.tsx` and
`components/landing/landing.css`. Existing semantic theme tokens, Inter/Chinese
fonts, shared pill Buttons, navigation labels and public URLs remain canonical.
The landing page is a marketing surface with stronger motion than the workspace.

The hero is a centered overlay composition: stock-research copy and two links
sit over a fixed, viewport-filling green signal-field background, owned by
`LandingBackground`. It continues behind the feature links while scrolling.
The shared page shell is transparent on the landing route; header fill is
translucent. Waves uses a narrow edge fade so it fills the screen. A theme-aware
radial veil softens the field behind the text for contrast. The former pause control is removed at the user’s request; a short caption
remains at the bottom of the hero.
The former closing CTA section is removed, including its accompanying text,
as requested. The feature links lead directly into the existing footer.
Header destinations are grouped in the shared Radix dropdown behind a single
Navigation button. Both that menu and the feature links use the shared
`components/landing/landingNavigation.ts` destinations in this order:
Stock research / 股票研究 (`/research`), Creator opinions / 博主观点
(`/creators`), Stock directory / 股票目录 (`/stocks`).
On phones the trigger is an accessibly labelled menu icon; the redundant
header signup CTA is hidden while the hero signup action remains available.
Selecting a destination closes the menu and opens its public route. The artwork has no central
Logo disc or circular frame. The previous
NVDA/TSLA/AMD stock reader is removed from the homepage. The signal field is
abstract brand artwork, not a chart or a representation of market data.
React Bits Waves is vendored under `components/landing/react-bits/`, alongside
its license; it uses native WebGL2 without adding a runtime dependency. The artwork is decorative; navigation and copy remain usable without WebGL.

The headline cycles through five localized two-line phrases using typing,
reading pauses and deletion, with a blinking caret. Both line heights are reserved
so the actions do not move during a cycle. Initial HTML contains the complete
first phrase, which also remains the stable accessible heading; animated text
is hidden from screen readers. Locale changes reset the cycle, and offscreen or
hidden-document states suspend its timer. The primary CTA responds to mouse
proximity, and feature links reveal once on entry. The hero's primary link opens `/auth`; its secondary link opens
`/research`. Product navigation anchors the hero. Existing feature links retain their routes, portfolio visibility switch and content owners.

The three feature destinations form a compact row capped at 920px, using
16px headings, 12px descriptions and 16px arrows with 24/32px section padding.
They stack with compact spacing on phones and retain at least 44px click targets.
The composition remains centered at every breakpoint, with 20px phone gutters. Desktop display type
scales from 44 to 72px; phone type scales from 36 to 54px. Both light and dark
modes use existing theme colors, with green as the only accent. The hero reserves a responsive minimum height to prevent layout shifts.

System reduced motion makes the field static, removes pointer/click responses,
disables magnetic movement and shows the complete first headline without a caret
or typing timer. Waves suspends drawing while
outside the viewport or when the document is hidden. Supporting reveals retain
keyboard-focus handling and reduced-motion behavior. No global tokens, metadata, JSON-LD or authenticated workspace behavior change.


### Portfolio visibility

Portfolio is temporarily hidden through `lib/productFeatures.ts`. Navigation,
landing promotions, holdings filters and position panels follow this switch.
Disabled portfolio URLs redirect to Markets; account and holdings data are retained.
The homepage feature grid adapts to the number of visible entries.


## Market overview

Markets presents S&P 500, NASDAQ Composite, Dow Jones, Russell 2000 and VIX
as five equal index cards above the stock list and desktop rail. Each card groups
its trading date, index symbol, point value, signed change and a 96px chart.
Index points have no currency prefix; the data uses the actual index symbols
(^GSPC, ^IXIC, ^DJI, ^RUT, ^VIX), rather than ETF proxy prices.
The shared range controls update every chart. Cards stay at 272 × 272px in a single horizontal row on every viewport.
The overview scrolls horizontally with a visible themed scrollbar, native touch
and keyboard scrolling, and proximity scroll snapping; cards never shrink or wrap. They retain existing
card/background/border tokens, 12px corners, tabular figures and semantic
green/orange direction colors. Missing data keeps card geometry and offers
retry; dates come from chart data. Other market lists and analysis routes retain
their existing owners.

Market overview cards link as a whole to the corresponding index detail route.
`lib/marketBenchmarks.ts` owns the five supported index symbols; the market
route accepts that allowlist alongside ordinary tickers. Index detail headings
show localized index names and point values without a currency prefix. Card
retry buttons remain separate from the link, with independent keyboard focus.


### Market activity lists

The market movers section retains flat rows and existing text/direction colors.
Creator coverage quotes load in batches of five with at most three requests in
flight. Successful batches render immediately; pending prices show skeletons,
and a partial failure keeps valid quotes and exposes a quote retry action. The
proxy preserves cached successes and never turns failures into zero prices.
The backend bounds quote workers and batch wait time so an unavailable symbol
cannot block the full catalogue or the server event loop.

A 160px wrapper bounds the shared Select so its default full width cannot expand
the header. List filters and the result count sit inside the canonical list card
(see **Canonical list cards**); the column header precedes 80px hover rows without
per-row separators. A passive sparkline sits between creator consensus
and price, following the shared 1D/1W/1M/3M range. Desktop fixed columns are
120px consensus, 88px trend, 88px price and 72px change. On phones, the trend
keeps a 72px column; price and daily change stack in an 80px column and creator
consensus is hidden. Row links include the trend and still open the K-line page.
Trends use actual close observations, with green/orange based on range endpoints
and a muted line for no net change. SVG previews contain no interactive elements.
They load within 200px of the viewport, queue at most three history requests,
reuse successful results for five minutes, and cancel on range/list changes.
Missing history is shown as a dash, never as a synthetic curve.
The creator updates rail aligns its heading with the movers heading, uses 80px
rows and places its stock-directory link after the updates. A thin divider
separates the rail on desktop. All entries retain their existing detail routes,
shared logos, opinion-strength presentation and keyboard focus treatment.

The shared primary navigation order is Markets, Daily Briefs, News, KOL Opinions,
then Research. Chinese navigation labels are 行情、日报、新闻、KOL 观点、研究.
`components/layout/navItems.ts` owns this order for the sidebar and mobile tabs;
existing destination routes and active-state matching remain canonical.

### Macro indicators in Markets

Markets uses the shared Radix Tabs primitive in this order: Market overview,
Market trends, Macro indicators. Market trends is the second tab and owns the 27 added cards (sectors, styles
and cross-assets) and their range controls. The five major index cards remain
in Market overview above the stock list.
`/dashboard?tab=trends` restores it on refresh. Market overview retains index cards, stock
movers and creator updates, with range controls shared by indices and stock previews. The
selected chart range is shared across overview and trends while switching tabs.
Each tab loads only its own quotes/context; visiting overview does not request
all market instrument quotes.
`/dashboard?tab=macro` restores the selected tab on refresh; other query parameters
are preserved. StockLookup remains above both tabs. Each panel mounts its own data
requests and Ask Kolvex context, so macro figures do not mix with intraday quotes.

Macro indicators uses native cards with the existing card/border tokens, 12px
corners, tabular figures and shared ScrubChart. A responsive grid uses a 260px
minimum card width and collapses to one column on phones. Eight cards cover
Treasury yields, the 10Y−2Y yield spread, CPI/core CPI YoY, unemployment, monthly
nonfarm jobs added and real GDP annualized quarterly growth. Shared 1Y/3Y/5Y
controls change every chart, with 3Y selected initially. Rates are daily, inflation
and employment monthly, and GDP quarterly; each card states its observation
period and calculation method instead of implying all data is from today.

The selected tab provides the visible section title; the content heading is
screen-reader-only and the redundant introductory subtitle is omitted. The compact
toolbar contains only range controls and refresh. Empty status messages reserve
no visual block between it and the cards. Card headings lead, with the publication
frequency alongside them rather than a repeated category eyebrow.

Macro curves use green/orange for the selected range's first-to-last movement;
signed changes use the previous observation's direction. These encode increases
and decreases, not economic desirability or investment returns. Macro chart fill
roles locally map to the contrast-safe `positive`/`negative` text tokens, preserving
existing market chart colors. A short footer explains the two comparison periods.
Hovered points
show their own historical value/date and suppress the latest-period delta until
hover ends. A native Recent values disclosure sits below the source link as its
own full-width block, with a full-width summary, rotating chevron and fixed-layout
table. Date row headings align left and tabular numeric values align right without
wrapping; expanding it never inherits the source link's remaining width. It provides keyboard-accessible
dates and values for the latest 12 observations. Every card links to its source
series, with government-origin attribution and retrieval time below the grid.

The allowlisted public-domain Federal Reserve, BLS and BEA series are retrieved
through FRED public CSV/ZIP downloads, without a paid key. Checks are cached for
six hours and failures retry hourly. Missing values stay as dashes; cached old
values are marked delayed. Loading, empty, partial, stale and expired-session
states have explicit bilingual copy and retry/sign-in actions.


### Shared AI result history

AnalysisHistory and DrawingVersionSelector use the shared Button and Select
primitives for Everyone / Mine filtering, author labels, and version selection.
All generated results are visible to all signed-in users. The initial result is the viewer's
current version when available, otherwise their latest result, otherwise the
newest result from any user. Server-derived ownership controls restoration;
viewing another author's version is read-only and never changes their data.
The research detail header states public visibility without a publishing toggle.
Existing disclosure layout, tokens and bilingual copy remain canonical.

The 32 reference instruments are split between five overview indices and
27 instruments in the Market trends tab, grouped into sectors, investment styles
and cross-assets. `lib/marketBenchmarks.ts` owns the catalogue;
ETFs stay separate from the five-index route allowlist. Sector coverage includes
banks, utilities, REITs, technology, healthcare, defense, insurance, semiconductors
and software. Style cards use IWD, IWF, MAGS (explicitly an equal-weight ETF), RSP
(ETF proxy for the equal-weight index) and SPHB (high-beta ETF).

Both market and sector/style cards share 272 × 272px geometry, fixed single-line
headings, an actual observation date, a 96px chart and a short unit/method caption.
All four groups scroll horizontally with the established visible scrollbar,
keyboard focus and touch behavior. Shared 1D/1W/1M/3M/1Y/QTD/YTD controls update all groups and stock-list previews.
The controls wrap on narrow screens. QTD and YTD follow the current New York
calendar quarter/year and include the preceding close as their return baseline.
1Y uses the latest observation’s one-year anniversary, with a prior close.
Two years of daily history retain these boundary values; missing pre-period
history leaves the full-period change unavailable. Daily series with no release
in the current quarter/year do not show the previous period’s return.
History loads near the viewport and reuses the three-worker cached stock-trend
queue. Missing data remains unavailable with retry, never a fabricated curve.

Cross-assets cover the dollar index, 2-/10-year Treasury yields, TLT, MOVE,
high-yield OAS, gold futures, WTI futures and bitcoin. Index values are points,
prices are USD, yields/spreads are percentages with changes in basis points.
Gold is USD per troy ounce; WTI is USD per barrel. Treasury yields and ICE BofA
high-yield OAS use allowlisted FRED CSV observations via
`/api/market/observations/[series]`, cached for six hours with source attribution.
These series remain distinct from the government-only macro snapshot service.
Daily cards show actual release dates; 1D compares the last two observations.
MOVE also uses daily history. Source cards link to FRED or Yahoo; tradable ETF
and crypto cards retain their market-detail links. Futures and index data are
not relabelled as ETFs. Ask Kolvex context lists all four instrument groups.

### Market display preference

Market overview indices and Market trends share a Cards / List segmented control
beside the toolbar. Cards remain the default. The chosen display is stored
locally under `kolvex:market-view`, validated on load, and retained across tabs
and refreshes; unavailable browser storage does not disable the control.

List mode is a comparison matrix matching the supplied market-performance table:
one row per instrument, latest daily close/observation, then 1D, 1W, 1M, 1Y,
QTD and YTD side by side. It replaces the range controls with a comparison label;
returning to cards preserves the selected chart range. The groups and tab ownership
remain unchanged: indices in overview; sectors, styles and cross-assets in trends.

`MarketComparison` owns the native table and per-row viewport loading.
`lib/marketComparison.ts` owns the tested calendar/return calculations. A single
two-year daily history per instrument feeds every column, reusing the cached
three-worker stock-history queue or allowlisted FRED observations. Price performance follows the existing adjusted-history source. All columns
use that row's same dated closing observation, never an intraday quote mixed with
old history. Active daily candles are excluded: US asset days are conservatively
complete at 17:00 New York, crypto at UTC midnight; published FRED observations
retain their own release dates. Rolling periods use the last close on/before their calendar target;
QTD/YTD use the close before the current New York quarter/year. Missing baselines,
large source gaps, newly listed assets or no current-period release show dashes.
Prices show percentage returns; Treasury yields and credit spreads show percentage
point changes (pp); MOVE shows point changes. Positive/negative cells use semantic
green/orange signed text with very faint number-sized tints (2.5% in light,
6% in dark), rather than whole-cell heatmap fills. Neutral cell surfaces and
quiet horizontal hairlines lead the table; rounded zero is neutral. Source and
unit notes distinguish ETF proxies, futures and rates.

The table scrolls horizontally in its own focusable region with a visible scrollbar,
while the first instrument column stays pinned. On phones all comparison columns
remain available without shrinking the figures. Native row/column/group headings,
per-row dates, detail/source links and separate failure retry buttons remain
keyboard accessible. Card styling and its seven time ranges remain unchanged.

## Client data caching

`lib/clientCache.ts` owns bounded browser memory snapshots and in-flight request
sharing. `hooks/useCachedResource.ts` owns initial loading versus background
refresh. Returning to a cached route paints the snapshot synchronously; stale
snapshots revalidate without replacing readable content with a skeleton. Explicit
refresh bypasses freshness, and successful writes invalidate the related URL
namespace. The auth client clears snapshots and aborts requests when account
identity changes. Cached data and provider availability are never shared by SSR;
API key values are excluded. Detailed policies and verification are recorded in
`../docs/frontend-data-cache.md`.

### Market event calendar

Markets adds Event calendar between Market trends and Macro indicators; URL state
uses `tab=calendar`. Shared Radix Tabs own the outer view and the three week
selectors. The server fixes the window to last/current/next Monday-based weeks
in America/New_York, including DST. Only published high-impact or hot events
appear. Week selectors, the week summary and the calendar grid share one card body
below the section heading, matching the Markets observation card: 24px card radius,
1px border, card surface and 12–16px inner padding. Day sections are their own
cards with 16–20px padding, semantic headings, a per-day event count and divided
event rows instead of nested bordered boxes. A labelled Calendar / List button
group switches presentation without changing the selected week or fetching data.
Calendar is the default: seven equal Monday-to-Sunday columns, including empty
days, with today's border highlighted. Event summaries show their opening four
lines inline; only the remainder hides behind an explicit Event details/Show less
disclosure, so the week reads without opening every event. Calendar columns retain
a minimum width of 23rem (368px), with 16px gaps; the seven-column grid has a
168rem minimum width. The calendar region is constrained to the content width and
scrolls horizontally from the card body, with a visible scroll hint, labelled
scroll buttons and keyboard focus. Day cards carry no background animation and event
rows highlight on hover without moving; List keeps the same static cards. Long
source names wrap within their event row. List preserves one reading column with
full summaries and hides empty days. Both views retain event ordering, tickers and
source links.
Chinese/English dates and labels use useCopy, with explicit Eastern-time context.
Loading skeletons, empty weeks, error/retry and refresh use shared primitives.
The calendar checks cache freshness when the tab resumes, reconnects and each minute.
Fresh responses are reused for one minute; recent snapshots remain visible during
background refresh and recoverable refresh failures. Manual refresh bypasses freshness.
Admin's Major events section reuses Input, Textarea and Button for JSON import,
validation preview, upsert and loading saved events for editing. Drafts stay
mounted across admin tab switches; dirty edits disable replacement by a file or
another event. Textarea owns typed JSON dates and timestamps; no date-picker
popup is introduced. Business/schema/permissions are in docs/market-events.md.

### Three daily editions

Daily Briefs uses the shared Radix Tabs for pre-market 1h (`morning`), intraday
(`intraday`), and post-market 1h (`evening`). The edition capsule fits its labels
instead of stretching across the toolbar. Refresh stays right-aligned and wraps
onto a separate row on narrow screens; the shared max-width and horizontal scroll
keep longer translated labels accessible. There is no underline beneath the pill.
Existing IDs and imported content
remain valid. Default selection follows regular US market hours in Pacific time:
pre-market before 06:30, intraday until 14:00, then post-market; URL selections win.
The admin importer uses the shared Select for edition selection and list filtering.
Auto uses the JSON edition; an explicit selection must match the validated JSON.
Changing edition invalidates preview/save state. Saving preserves immutable IDs,
idempotent retries, and the shared reader-cache invalidation. No new theme tokens.

### Brief content language

Daily Briefs displays administrator-uploaded Chinese/English content according to
the existing saved user language preference. There is no article language control
and no automatic translation or translation API request. `localizedBrief` selects
the uploaded `translations[locale]` without modifying the stored envelope.
`language` identifies the base content (legacy default: zh); translations supplies
only the other language's title, headline, subtitle, full sections and disclaimer.
Date, type, ID and generation time are shared. Hero images fall back to the source
image when the localized copy has none. Missing languages show the original.
`BriefContent` owns this rule for the reader and admin preview; page titles use
the same selection. Backend validates nested sections and URLs; translations
cannot override identity. Admin saves both languages in the existing JSONB payload.

### Admin daily brief CRUD

The Daily Briefs admin tab is labelled 日报管理. It reuses shared Button, Select,
Textarea and Dialog. The existing importer is the create/edit form; list rows
have explicit View, Edit and Delete actions. View opens a read-only Dialog and
does not overwrite a draft. Edit loads the full original bilingual JSON into the
editor. Existing IDs, dates and edition types cannot be changed by an edit.
Validation gates each save. A discard Dialog protects unsaved content when
resetting, replacing a file or opening another record; page unload uses the narrow
beforeunload mechanism. Save preserves entered JSON on failure.

Delete uses the shared modal Dialog, initially focusing Cancel, naming the issue
and warning that both languages are permanently removed. Failure remains in the
dialog with retry; success focuses the list heading and clamps pagination.
Admin GET detail supplies a revision token; PUT/DELETE require If-Match and
compare that revision atomically in the database. A stale edit/delete returns 409.
Successful create/edit/delete invalidates the shared reader and calendar cache.
Browser database access remains denied; verify_admin owns all write operations.

## X creator content

`/dashboard/x-opinions` uses DashboardLayout and OpinionSourceNav, with the
existing semantic tokens and shared Button/Input controls. Desktop places the creator directory in a 300px right rail beside a single
chronological feed, matching the YouTube overview. Mobile stacks the directory
above it. Posts use hairline-separated rows on the page background, with the shared
Avatar and initial fallback. Public profile facts include biography, website, location
and known follower/following counts; absent facts are omitted. Profile administration
can load and edit these fields. Post text, quotes and biographies translate automatically to the saved user
interface locale as they approach the viewport. A shared three-request limit
bounds translation traffic. Switching locale cancels stale work; an explicit
original/translation toggle and retry remain available, with machine-translation
attribution, an original toggle, cancellation and retry. Translations stay in a
bounded session cache and never replace stored originals. The page title is screen-reader-only, with no visible introductory
heading or description. Author, stock ticker and page are committed URL filters. Stock filter
validation is explicit on submit, with a localized clear action and inline error.
New requests cancel old ones, time out, and retain a retry action. No-results
and first-use empty states explain how to recover.

Administrator controls live exclusively under `/dashboard/admin?tab=x` in the
X content tab, using `components/admin/XContentManager` and the existing
UserProfileProvider permission state; the backend verifies permissions independently.
The reader has no management form. The manager opens directly without a nested
collapsible wrapper. Profile saves are explicit and
imports follow file selection, validation preview, then import. Input and preview
state remain transient on this page; no draft or file is persisted in browser
storage. Imported IDs are skipped on conflicts, making retries safe. Source text
wraps naturally, quoted text uses a muted surface, and source/media links open X.
Dates and numbers follow the active Chinese/English locale and reader timezone.
Unknown engagement counts are omitted rather than rendered as zero.


### Stock workspace on phones

The stock price preview uses the full page width below 640px, with one inset
for the plotting area. The line chart leads; AI actions stay collapsed below it
beside the quiet Advanced entry. Fullscreen candlesticks keep manual drawing
tools visible and AI controls in a mobile popover. Editing controls wrap to fit
narrow screens without shrinking their 44px touch targets.
Stock insight tabs stay in one horizontally scrollable row on phones, retaining
Radix keyboard navigation and the active underline. Summary facts use separated
rows on phones and the existing three-column layout on larger screens.

## Markets overview refinement

Dashboard reading surfaces use the flat background token without a decorative
grid. Markets has a centered 1600px maximum content width; direct stock lookup
is capped at 672px. Main section headings use 20px semibold, with the secondary
creator rail at 18px. Instrument names and controls use 14px, primary index values
24px, stock tickers and prices 16px, and metadata 12px. Numeric columns retain
tabular figures.

Market cards are 240px tall with 64px charts. Five equal columns fill the wide
desktop overview; smaller screens retain a single horizontally scrollable row
with 240px cards so the stock list stays close to the overview. The lower grid
uses a flexible stock list and a 320px secondary rail with matching header height.
Stock watch, Watchlist and Creator updates use matching card bodies below their
headings: shared Card, 24px corners, semantic card fill, 1px border and 12px padding
on phones / 16px from sm. Section headers share a 56px minimum height and a 12px
gap above their card. Stock rows stay flat within the card. The rail has no extra
vertical divider; card boundaries separate its modules. Creator updates uses the
same top-divided footer link as Watchlist. The plain Panel variant is unchanged
for other screens; only these Markets sections opt into the card body.
Range and view controls use neutral foreground selection; stock scope selection
uses the muted surface. Brand green remains on the primary lookup action, active
navigation and focus indicators, with semantic positive/negative data unchanged.

The Markets secondary rail leads with a compact Watchlist card above creator
updates. It uses the shared browser-local watchlist store and quote cache, previews
the six most recently saved symbols, and groups known stocks by the maintained
sector catalogue. USD crypto pairs use Crypto; unclassified symbols use Other
stocks. Native disclosures collapse each group. The header shows displayed/total
count, refresh and a link to the full Watchlist; empty, loading, partial quote
failure and session-only storage states remain explicit. Mobile places the rail
after the stock observation list. No quotes or sector classifications are invented.

## Interaction feedback

Green means direction, not interaction. Hover, focus and press feedback is a
neutral grey layer built from the `foreground` colour at low opacity, so a
hovered row, chip or menu item never reads as a price signal and never competes
with the green/orange-red the data already uses for up and down. Green is
reserved for two things: direction semantics (`positive`, `negative`,
`chart-up`, `chart-down`) and solid brand actions.

There are no separate interaction tokens. Feedback is authored inline from the
existing palette, which keeps dark mode correct without a second set of
variables to maintain:

- `bg-foreground/[0.04]`–`/[0.06]` fills a hovered or focused surface; rows use
  `/[0.06]`, form fields a lighter `/[0.04]`. Pressed states deepen to `/[0.1]`.
- `border-foreground/25` draws the hover hairline on bordered controls, table
  rows and disclosure boundaries; `border-foreground/35` marks the pressed edge.
- Hovered labels and glyphs resolve to `text-foreground` rather than to a
  coloured accent, so text contrast is never weaker on hover than at rest.

Rules that follow from that:

- Filled brand buttons (`default`, `icon`) keep their green fill and darken it on
  hover and press; they are the one interactive control that stays green.
- Neutral `outline` and `ghost` Buttons take a grey hairline and wash on hover,
  and a deeper grey wash while pressed. `link` and `text` actions rest on
  `text-foreground`, not `text-positive`, so a navigation link is not mistaken
  for an up move.
- List rows (`ListRow`, `listRowTargetClass`, `listCompactRowClass`) wash in
  `foreground/6` with an outline on keyboard focus. Feed rows use
  `listFeedRowClass`, whose `list-row-interactive` component class paints the
  neutral wash and darkens the row hairline on hover or `focus-within`; there is
  no leading accent mark.
- Tabs, `SegmentedControl`, `SwitchTab` and every authored pill select with
  `bg-foreground` plus `text-background`, or a `secondary` fill with
  foreground text. Unselected options preview with the same grey wash.
- Desktop sidebar, mobile dock and the mobile opinion source nav take a grey
  wash on hover; the selected route is the only entry marked, by its solid
  secondary pill. Icons follow the text colour instead of turning green.
- Menus (`DropdownMenuItem`, `MultiSelect`, native disclosures) highlight on a
  grey wash with foreground text.
- Tables keep semantic positive/negative direction colours untouched; the row
  wash, hover hairline and sort order indicators are neutral too.
- All of it is colour and border feedback with 150ms transitions and no new
  motion, so `prefers-reduced-motion` behavior is unchanged. `prefers-contrast:
  more` strengthens the hovered hairline.

## Focus without rings

Ring utilities are disabled in `tailwind.config.ts`. Components do not use ring
colors, widths or offsets, including sidebar navigation and decorative rings.
`app/globals.css` provides keyboard focus feedback through secondary background
and underlined text instead of surrounding ring shadows. Focus carries a 2px
`primary` outline because a keyboard-focus ring is a distinct affordance, not
data; the focused background behind it stays neutral grey.

### Floating mobile navigation

Below lg, Markets, Watchlist, AI Research and Menu share one centered floating
capsule. There is no separate search action. The supplied iOS glass reference
owns this material: a translucent white tint in both themes, 24px background blur,
saturation and a fine reflective edge. The dock has no opaque black fill.
Active routes use a neutral inset pill and foreground icon. Targets are at least
44px; icon-only controls retain localized accessible names. All other routes
remain available through the sidebar menu.

Page-level scroll viewports extend beneath the glass; their bottom clearance and
scroll padding keep the final row reachable above it, including the safe area.
Fixed-composer pages retain AppShell's reserved inset. Nested tables and popup
scrollers are excluded. Safari uses the prefixed backdrop filter; unsupported
browsers, reduced transparency and increased contrast use a solid secondary
surface. Desktop navigation is unchanged; no global theme colors change.

## Markets rounded surfaces

Markets uses a Robinhood-inspired rounded treatment: pill search inputs, select
triggers, scope filters, range buttons, view switches and primary tabs. The shared
Tabs primitives own the opt-in `pill` variant; existing tab styles remain the
default elsewhere. Market cards, comparison surfaces, calendar day containers
and the watchlist use 24px corners (`rounded-3xl`); rows and popup menus use 16px
(`rounded-2xl`). Time ranges stay in a single pill track and scroll horizontally
on narrow screens. Shared Input and SelectTrigger own an opt-in `shape="pill"`
so their default corner styles cannot override the Markets treatment.
Market overview, trends, calendar and macro indicators share this treatment,
with existing typography, data colors and focus feedback retained.

## Application-wide rounded geometry

All pages share the Markets rounded style. Single-line inputs, search fields,
select triggers, buttons, navigation and segmented controls use pill corners.
Input and SelectTrigger now default to the pill shape; TabsList and TabsTrigger
default to the pill variant, including the two-column auth tab layout.
Cards, dialogs, textareas and large containers use 24px corners. Rows, popup
menus and compact surfaces use 16px corners. Fullscreen surfaces, directional
sheet edges, chart marks, checkboxes and brand assets retain functional shapes.
These rules apply to research, creator opinions, portfolios, watchlists, news,
briefs, chat, settings, admin, authentication and public reading pages. Existing
ring utilities remain disabled.

## Canonical list cards

Every collection list in the web app reads as one shared list card. Markets'
**Stock watch** surface is the reference, and `components/ui/list-card.tsx` owns
the primitives: `ListCard`, `ListToolbar`, `ListColumnHeader`, `ListRows`,
`ListRow`, `listRowTargetClass`, `listFeedRowClass`, `ListLoadMore`,
`ListFooterLink` and `listCompactRowClass`. `components/decision/Watchlist.tsx`
is the adopted reference for a full list page. Lists reuse this shell instead of
defining their own box, header, hover or load-more styling.

The Shared List Card Rule:
- The section heading (and its count, refresh or view-all action) sits outside
  and above the card, following the Markets heading rhythm.
- The card body is one `ListCard`: 24px corners, 1px border, card surface and
  12–16px inner padding. Lists never nest cards, and rows never become boxed
  cards inside the card.
- Search, scope pills, sort and result counts sit in an in-card toolbar; status,
  stale-quote and retry notices sit between the toolbar and the rows.
- Column lists show a `ListColumnHeader`: 12px muted labels with a hairline
  bottom divider. Data rows use `ListRow` + `listRowTargetClass`: at least 80px
  tall for stock rows, 16px corners, a transparent resting background and a muted
  hover/focus-within fill. Stock rows carry no per-row dividers.
- A trailing action (watch star, disclosure, chevron) is a sibling of the row
  link, never nested inside it. Row height, logo size, price/change alignment,
  tabular figures and the semantic green/orange tokens match Markets.
- Long-form feeds (opinions, X posts, headlines) keep the same card shell, but
  their rows keep hairlines, a 24px reading rhythm and `last:border-0` so the
  card edge is not doubled; prose keeps its existing typography.
- Footers use `ListLoadMore` for explicit pagination and `ListFooterLink` for the
  "view all" route. Empty, loading, retry and partial states stay inside the
  card without adding a second surface.
- Native data tables (Reddit's desktop ranking, portfolio positions and
  transactions, Market comparison) keep their table semantics and horizontal
  scrolling inside the same card surface instead of becoming fake list rows.
  Ordered ranked collections keep a native `<ol>` with `ListRow`; table-in-card
  surfaces may use the full-bleed `!p-0` variant until a padding variant exists.
- Existing semantic theme tokens, Inter/Chinese typography, pill controls,
  `prefers-reduced-motion` behavior and keyboard focus feedback remain canonical.
  Ring utilities stay disabled.

Deliberate exceptions: admin authoring forms and management tables, chat and the
command palette, article/report prose, marketing surfaces, calendar grids, and
chart or metric matrices are content or tooling, not list cards. They keep their
current owners.

Adoption map:

| Surface | Canonical owner | Presentation |
|---|---|---|
| Markets stock watch | `components/decision/StockObservationList.tsx` | Reference list card |
| Watchlist page and rail card | `components/decision/Watchlist.tsx`, `MarketWatchlistCard.tsx` | List card, with 1D trend in the page list |
| KOL opinion page and directories | `components/youtube/YouTubeOpinionExplorer.tsx`, `OpinionList.tsx`, `VideoOpinionCard.tsx`, `OpinionCard.tsx`, `OtherCreatorOpinions.tsx` | List cards with feed rows |
| X creator content | `components/x/XContentExplorer.tsx` | List cards for creators and posts |
| Reddit ranking | `app/dashboard/reddit-opinions/page.tsx` | List card with native table/list rows |
| News terminal | `components/news/NewsFeed.tsx`, `NewsRows.tsx` | List card inside the terminal reading column |
| Public directories, public opinions | `components/public/ReadingDirectories.tsx`, `ReadingElements.tsx` | List cards |
| Updates and holdings changes | `components/decision/Journal.tsx`, `PortfolioChanges.tsx` | List cards |
| Analysis history | `components/decision/AnalysisHistory.tsx` | List card |
| Portfolio positions and transactions | `components/portfolio/**` | List card surfaces around native tables |
| Published research list | `components/trading-analysis/PublishedResearch.tsx` | List card or same card grid |

## Opinion feed background and motion

X and Reddit use the same `bg-background` page ground as the rest of the
workspace. Their collections sit in the shared list card; feed rows keep hairline
separators and muted hover feedback inside that card instead of adding a second
page-level border. X creator filters use pill geometry and 150ms color feedback.
Result changes use a 180ms fade and rows arrive over 220ms with at most 120ms
stagger, including mobile rows. Animations start from visible content, never
gate interaction, and stop under `prefers-reduced-motion`. Refresh and loading
controls use existing spinners.

### Weekend brief reader

Pacific weekend dates show a single Weekend brief heading and daily cadence note
in place of session tabs. Refresh stays right-aligned and dates remain navigable.
Weekend article metadata and calendar cells use the same label; empty copy never
suggests changing sessions. Existing evening issue IDs are the canonical weekend
storage key. Weekday navigation retains its fitted three-option pill.

### X opinion summary snapshots

The X feed renders saved bilingual AI summaries above posts, grouped by creator
and filtered by the selected author. The existing ListCard contains a compact
headline row for each creator; native disclosures reveal reasoning, caveats and
original source links. Dates use the reader locale and timezone. The scope note
explicitly identifies selected, incomplete coverage and potential other stocks.
The summary endpoint verifies every citation exists and belongs to its creator
before returning a snapshot. Reading does not call a model or generate a fresh
summary. This is a saved editorial snapshot, not a scheduled-generation service.
Missing snapshots and recoverable failures leave the underlying feed available.

### Content loading skeletons

Initial content requests use the shared `ContentSkeleton` for lists, text feeds,
compact creator videos, articles and profile forms. Existing specialized chart,
financial and portfolio skeletons remain canonical. Shapes use the shared
Skeleton token, hide decorative blocks from assistive technology, announce one
localized status, and disable pulsing with reduced motion. Content remains
visible during cached background refreshes. Button submissions, authentication
processing, AI generation/streaming, translation and sync actions retain explicit
progress feedback; they are not cold content placeholders.

When Technicals has no AI results, show one compact empty state: icon and explanation,
window metadata, one generation action and a short drawing hint. The action sits beside
the explanation when space permits and wraps below on narrow surfaces. Omit the empty
history footer after a successful zero-result load and the separate setup placeholder
until an analysis exists. Keep history loading, error and author-filter recovery visible.

The advanced chart AI action group uses two aligned, equal-column rows: analysis and
drawings first, settings and drawing visibility second. Buttons fill each cell with
44px minimum height and 8px gaps. Visibility uses the existing short label in this
narrow control group and retains its full accessible name. Without saved drawings,
settings stays in the left cell. Compact chart controls retain their wrapping toolbar.

YouTube Creator Opinions shows price/strength charts and creator-call markers without
AI technical controls, AI overlays, results or history, including in its advanced chart.
AI technical analysis belongs to the Markets stock workspace.

### AI Research grouped task library

The signed-in library groups completed report summaries by normalized stock symbol.
Each native disclosure shows the stock, total task count, latest research-date
conclusion and date. Expanding lists every task, newest research date first,
with author, provider, duration, short task ID and its existing report link;
the explicit stock link preserves Markets navigation. Same-date tasks stay
separate. Missing conclusions are not inferred. English/Chinese copy and dates
follow the reader locale. Load all summary pages before grouping, then paginate
12 stocks per page, so one stock's tasks cannot split between pages. Failed or
incomplete catalog loads retain the retry flow rather than showing partial
counts. Permissions and the anonymous report-card library are unchanged.
