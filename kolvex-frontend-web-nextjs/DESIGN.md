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
Creator detail pages order the latest video opinions, opinion history, then most
discussed stocks in one reading column on all screen sizes. The stock list sorts
by opinion count, initially shows at most five stocks, and offers a labelled
expansion to the full searchable list and a collapse action.
Recent opinion changes follow the directory in the left column. Its right rail
orders latest opinions and my holdings; the latest section links to the paginated `/dashboard/youtube-opinions/opinions` list. Updates
remains accessible by legacy URL but has no primary navigation tab. Legacy Research URLs redirect
to the appropriate entry so refresh and saved links keep working.

AI Research detail pages lead with the existing final conclusion, then the
investment plan, analyst evidence and supporting debate. The reading area uses
16px body text on mobile and 17px on desktop, line height 1.85 and a maximum measure of 72ch within the
available reading column. Markdown titles are subordinate to the stock heading; paragraphs
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
- The stock workspace offers user-requested private AI analysis generation and version history. The public report library retains its reading workflow.

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
sidebar and five-item mobile navigation. The route is readable by signed-in
users; only administrators import content. Importing makes the issue visible
immediately, as requested in the reader-flow extension.

The library uses the existing 1080px reading width, 16/32px page padding,
Inter/Chinese stack and semantic light/dark tokens. Latest-issue photography
sits beside a left-aligned headline on desktop and above it on phones. Older
issues form quiet divided rows rather than promotional metric cards. Supplied
image credits remain visible. No new colors, fonts or token values are added.

All/Morning/Evening are shared pill Button links with `aria-current`; filters
and pagination live in the URL. The API returns ten issues per page. Each issue
has a durable detail URL; header/footer return actions preserve the originating
filter and page. `HeaderBackButton` owns the icon return control.
`BriefContent` owns the article in both admin preview and the reader, and
`BriefImage` owns images, captions, credit links and failed-image placeholders.
Long text wraps; article disclosures remain in document flow.

`useBriefData` owns bounded, cancellable reads, stale-response protection and
focus/reconnection refresh. Loading uses the existing Loader2/status treatment.
Empty, missing, expired-session and retryable error states are localized.
Imported article text remains in its source language. `app/globals.css` remains
the theme and scrollbar owner; the page's established content scroller owns
vertical scrolling.
