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
  research-navigation: {}
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
owns the header. ResearchLayout adds shared route navigation, with each page
retaining its established content scroller. Pages use 16px horizontal padding on
mobile and 32px from the medium breakpoint. Report content stays within 1080px;
the creator overview retains its wider two-column layout and stacks on mobile.

Research has one primary navigation entry. Its two child views use native links,
48px targets, icons plus text and a green underline for the current destination.
No horizontal scrolling is needed for these two links. Preserve the selected
view in the route so refresh, browser Back and copied links keep context.

## Elevation & Depth

Reading surfaces are flat with quiet border separators. Hover adds the existing
muted fill. Reserve `surface-overlay` shadows and dark borders for popovers and
dialogs; research navigation and static lists do not require elevation.

## Shapes

Shared Buttons and primary sidebar selections are pills. Report rows use 12px
hover/focus rounding. Route navigation uses an underline and otherwise stays flat.

## Components

| Visual role | Runtime owner | Adapter and consumers |
|---|---|---|
| Semantic colors and themes | `app/globals.css` | `tailwind.config.ts` → shared UI and research views |
| Font stack | `tailwind.config.ts` | `font-sans`, `font-display`; global body sizing in CSS |
| Buttons and focus | `components/ui/button.tsx` | Pill variants; neutral navigation actions use `asChild` links |
| Research routes | `lib/researchRoutes.ts` | `ResearchLayout`, list entry points and report return links |
| Route navigation | `components/decision/ResearchLayout.tsx` | Creator and deep research views, `aria-current`, visible keyboard focus |
| In-page tabs | `components/ui/tabs.tsx` | Radix tabs for peer report panels; not a replacement for route links |
| Loading and data states | `components/ui/skeleton.tsx` and the owning list | Existing skeleton geometry, explicit empty/error states and retry |
| Scrollbars | `app/globals.css` | Global standards properties and WebKit fallback; new scrollers need no opt-in class |

Lucide outline icons accompany visible labels. Hover/focus must reveal no
otherwise inaccessible actions. Global reduced-motion rules apply to existing
page animations. Report data and author attribution come from the API; missing
reports get an empty state, never invented content. The behavioral companion is
`../docs/decision-workspace.md`.

## Do's and Don'ts

- Keep creator discovery and published reports within the same Research shell.
- Reuse semantic theme tokens, translated labels and shared UI primitives.
- Preserve administrator-only authoring and existing backend access checks.
- Do not add a separate primary Deep Research navigation item.
- Do not add report-generation controls to the reader workflow.
