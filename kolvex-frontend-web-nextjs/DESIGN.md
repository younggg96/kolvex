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
  row: "0.75rem"
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

## Typography

Inter and the established Chinese fallback stack serve headings and body text.
Research headings are 28px, growing to 32px on larger screens; navigation is
14px semibold, report identifiers 15px semibold and metadata 12px. Data uses
tabular numerals through `figure` or `tabular-nums`. Preserve Chinese line height
and allow descriptions to wrap.

## Layout

AppShell owns the viewport, desktop sidebar and mobile navigation. DashboardLayout
owns the header. Pages retain their established content scroller and use 16px
horizontal padding on mobile and 32px from the medium breakpoint. Published
reports stay within 1080px; Creator Opinions retains a wider two-column layout.

Markets, Creator Opinions and AI Research each have one primary navigation entry.
The stock detail route belongs to Markets. `StockLookup` at the top of Markets
uses the shared Input and Button to open any valid ticker, independently of
creator coverage. Its inline validation and clear action follow the active locale.
AI generation remains an explicit action on the stock detail page. Its existing K-line chart precedes
the change summary, AI technical read and creator history. Latest news, the
newest creator call and the linked position form the right rail on desktop;
on narrow screens these sections follow the chart. Creator Opinions shows the first
10 filtered stocks with a full stock directory at `/dashboard/youtube-opinions/stocks`.
Recent opinion changes follow the directory in the left column. Its right rail
orders latest opinions and my holdings; the latest section links to the paginated `/dashboard/youtube-opinions/opinions` list. Updates
remains accessible by legacy URL but has no primary navigation tab. Legacy Research URLs redirect
to the appropriate entry so refresh and saved links keep working.

AI Research detail pages lead with the existing final conclusion, then the
investment plan, analyst evidence and supporting debate. The reading area uses
16px body text on mobile and 17px on desktop, line height 1.85 and a maximum
72ch measure. Markdown titles are subordinate to the stock heading; paragraphs
and sections have distinct spacing. Desktop gets a sticky section directory;
mobile uses a horizontal text directory. Analyst tabs stay visible as words,
separate from article actions. Debate verdicts precede native disclosures whose
expanded text follows document flow, without nested vertical scrolling. Both
published and completed authoring reports use `ResearchReportContent`.

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

| Visual role | Runtime owner | Adapter and consumers |
|---|---|---|
| Semantic colors and themes | `app/globals.css` | `tailwind.config.ts` → shared UI and research views |
| Font stack | `tailwind.config.ts` | `font-sans`, `font-display`; global body sizing in CSS |
| Buttons and focus | `components/ui/button.tsx` | Pill variants; neutral navigation actions use `asChild` links |
| AI Research routes | `lib/researchRoutes.ts` | AI Research list, authoring and report return links |
| Route navigation | `components/layout/navItems.ts` | Markets, Creator Opinions and AI Research; `aria-current`, visible keyboard focus |
| In-page tabs | `components/ui/tabs.tsx` | Radix tabs for peer report panels; not a replacement for route links |
| Loading and data states | `components/ui/skeleton.tsx` and the owning list | Existing skeleton geometry, explicit empty/error states and retry |
| Scrollbars | `app/globals.css` | Global standards properties and WebKit fallback; new scrollers need no opt-in class |

Detail-page return navigation lives in `DashboardLayout.headerLeftAction` and uses
`components/layout/HeaderBackButton.tsx`: a ghost icon button with only a Lucide
arrow, a translated accessible label and tooltip, and the existing return target.
Keep it available in loading and missing-report states.

Lucide outline icons accompany visible labels except for these return controls. Hover/focus must reveal no
otherwise inaccessible actions. Global reduced-motion rules apply to existing
page animations. Report data and author attribution come from the API; missing
reports get an empty state, never invented content. The behavioral companion is
`../docs/decision-workspace.md`.

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

## Do's and Don'ts

- Keep creator discovery and the former Research overview within Creator Opinions.
- Keep published reports under AI Research and the stock detail route under Markets.
- Reuse semantic theme tokens, translated labels and shared UI primitives.
- Preserve administrator-only authoring and existing backend access checks.
- Do not restore the former Research or Deep Research navigation entries.
- The stock workspace offers user-requested private AI analysis generation and version history. The public report library retains its reading workflow.

## Stock analysis history

`components/decision/AnalysisHistory.tsx` owns the shared dated version list,
pagination, current marker, historical-view notice, retry and current-version
switching for both technical analysis and private research. Its `useStockHistory`
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
analysis focus controls apply to the text action. Each channel has a separate
history disclosure and its own current-version marker.


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

`PriceChart` supplies the two focus dialogs to `ChartView`'s AI control region.
A model field constrained to 240px precedes the primary AI analysis action and
secondary AI drawings action; both retain a fixed width while generating.
Focus settings follow on a separate row. Narrow layouts wrap in the same DOM
order. Generation is unavailable until a configured model is selected, with
inline guidance and a settings link when keys are missing. The shared authored
Select owns keyboard selection and a trigger-width, height-bounded popup.

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
| Overlay | `components/ui/dialog.tsx` | DESIGN.md; `PriceChart` and focus draft behavior | Default dialog; fullscreen chart with a header close action | Browser nested Escape, close, focus restoration and narrow layout |
| Disclosure | Native details; `AnalysisSummary` | Saved analysis payload | Technical evidence, plan rationale and full conclusion | Browser expand/collapse and long content |
