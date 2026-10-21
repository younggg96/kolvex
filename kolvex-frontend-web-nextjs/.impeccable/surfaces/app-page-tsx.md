---
version: 1
slug: "app-page-tsx"
primary_target: "app/page.tsx"
related_targets: ["components/pages/HomePageClient.tsx", "components/landing/LandingHero.tsx", "components/landing/LandingStockBrief.tsx", "components/landing/LandingPreview.tsx", "components/landing/LandingIntelligence.tsx", "components/landing/LandingCTA.tsx", "components/landing/landing.css", "components/landing/LandingScrollEffects.tsx", "components/layout/LandingHeader.tsx"]
---

# Public landing page

Mode: Operate. Scope: the public landing at `/`, within the existing Kolvex visual system.
User source: the supplied landing redesign brief, `已粘贴的文本.txt` (attachment d27cfd29-b575-4e3f-aca4-c52e12b3fd05).

## Direction contract

THESIS: Explain stock-centered market intelligence in the first viewport, then demonstrate how news, creator opinions, technical context and research connect without requiring an initial prompt.
OWN-WORLD: Retain Kolvex primary green, runtime semantic light/dark colors, Inter with the established Chinese fallback stack, flat bordered 12px content containers and shared pill controls. This is a surface extension; no new global identity or token sidecar is required.
STORY: Read the editorial proposition above an interactive stock reader; explore four intelligence layers; scan four editorial stock themes; see portfolio relevance; inspect source types and research reasoning; continue through “Less noise. More perspective.”
FIRST VIEWPORT: “The market is loud. Your view is clear.” / “市场很吵。重点，很清晰。” introduces the proposition above a full-width stock reader, with primary authentication entry and secondary product anchor. NVDA/TSLA/AMD tabs connect ticker identity and an illustrative move to news, creator perspective, technical context, synthesized research and a watch-next point, without a chart.
FORM: Code-led product storytelling using existing CompanyLogo, DirectionBadge, OpinionDistribution, TechnicalFindings and shared Radix Tabs. No new raster assets. Static examples carry visible illustrative labels rather than live-market claims.
FINISH: Fresh independent review of the revised hero returned SHIP, with no material findings in the supplied source and screenshots. Validation and limits are recorded below.

## Implemented composition and behavior

- `HomePageClient` composes the four landing sections inside BaseLayout; LandingHero includes LandingStockBrief. The landing wrapper exposes the active `zh-CN` or `en` language.
- Header navigation links to product/features anchors and public research. Signed-out entry uses `/auth`; authenticated header entry opens `/dashboard`. English/Chinese and light/dark controls remain available. On phones, the redundant sign-in link hides while the primary entry remains.
- The hero reader defaults to NVDA. Shared horizontal Radix tabs select NVDA, TSLA or AMD and update company/ticker, example move, news, market voices, technical context, research summary, watch-next point and `/stocks/[symbol]` destination together. Selected text and quiet neutral fill indicate state, without underline or decorative dot. Brand/company marks and functional arrows remain; decorative narrative icons are omitted.
- The supporting intelligence-layer example defaults to News. Market voices displays the actual compact OpinionDistribution with a labelled ten-opinion fixture. Technicals uses a structured AiTechnicalAnalysis fixture through TechnicalFindings; AI research juxtaposes bullish/bearish cases and their key assumption. Tabs expose vertical orientation above 800px and horizontal orientation below it.
- NVDA, TSLA, AMD and PLTR form a four-item editorial selection linking to public stock pages. Themes are explicitly illustrative, not recommendations or a live market feed.
- Portfolio examples relate positions to creator coverage, research/risks and technical context, with a link to the existing authenticated portfolio route. The example does not simulate an active brokerage connection.
- A source ledger distinguishes reported news, original creator video, market/indicator data and interpretation. Three native research disclosures place answers in document flow, with the first initially open. Public research and creator links retain their existing destinations.
- Primary hero and closing actions enter `/auth`. Same-page anchors preserve history and move focus to the target after scrolling; reduced motion uses immediate scrolling. Visible focus uses the semantic positive color.
- BaseLayout/footer, public route ownership, server metadata/Organization and WebSite JSON-LD in app/page.tsx, and the existing analytics wiring are retained.

## Surface design evidence

`app/globals.css` owns semantic theme colors, mapped by tailwind.config.ts; landing CSS aliases these runtime variables. Primary remains #00C805. Headings use foreground and text-safe positive; supporting text uses muted foreground. Borders, muted fills and separators provide depth without static shadows.

The desktop content width is at most 1200px with 48px gutters. Hero type scales from 52px to 80px at weight 600, line height 1.09, with 64px at widths up to 1100px and 51px up to 800px; phones use 40–62px with line height 1.12; section headings scale 30–44px at weight 600. The closing brand line scales 40–62px. Paragraphs generally use 13–17px text with generous line height; compact sample metadata is smaller. These values describe this surface, not a new application-wide type ramp.

At 1100px the gutter becomes 32px and gaps tighten. On desktop the stock reader places large ticker identity left, evidence center and synthesized research right. At 800px gutters become 24px and stock identity spans the reader width above evidence/research; supporting intelligence tabs run horizontally, section introductions stack and curated stocks become two columns. At 640px gutters become 20px; hero introduction and reader evidence/research stack, as do portfolio, trust, research and closing layouts. The curated selection remains two columns.

LandingParallax uses hero distances −28 for the headline and 64 for the focus stage: as scrolling progresses, the headline moves downward by up to 28px and reader upward by up to 64px. Supporting workspace, portfolio and research panels retain ±38px, ±52px and ±32px travel respectively. Phones use 30% travel. Active stock evidence rows enter over 600ms, staggered 75ms, with a 12px horizontal reveal; synthesized research enters over 700ms after 130ms with a 16px rise. Selected supporting content groups reveal once over 750ms with 75ms stock-list staggering; supporting evidence tabs enter over 350ms. Reduced motion removes spatial movement, reveals and transitions; focus finishes active reveals immediately.

## Verification record and limits

The implementation handoff reports successful TypeScript, lint and production-build checks. Browser checks covered both themes and locales, 1440px desktop, 390px mobile and 768px tablet, without horizontal overflow. Functional checks covered tabs, native disclosures, authentication destination and anchor focus. Those checks covered the supporting page before the hero refinement. The revised hero handoff additionally reports passing build, lint and type checks, plus functional stock tabs, keyboard and mobile verification. Current hero captures are `.impeccable/review/landing/{focus-hero-zh,focus-mobile-zh,focus-desktop-en}.png`; earlier supporting-page captures remain alongside them. Fresh independent review returned SHIP. Additional checks confirmed English mobile and Chinese tablet layouts without overflow, TSLA-specific summary and stock destination, and zero selected-tab border. Reduced-motion support was code-inspected rather than browser-emulated.

These are presentation and navigation checks: no live quote backend, completed authentication or portfolio linking was tested. Demonstration fixtures remain static and labelled; no invented testimonials, customer counts or performance outcomes are presented. No raster provenance record is needed because no new raster assets ship.

## Maintenance guardrails

Keep sample status visible when editing data. Reuse actual product primitives, preserve bilingual wrapping and verify both themes. Keep the editorial selection concise and source/interpretation distinctions readable. Preserve public/auth destinations, SEO and analytics ownership. Do not promote this page's layout or illustrative content into global product rules.

## User refinement — 2026-10-20

Landing tabs use selected text and a quiet neutral fill, without an underline or decorative dot. Remove decorative feature/check/document/sparkle icons from the landing narrative; retain brand/company marks and functional arrows/disclosure chevrons. Scope this preference to the landing surface without changing shared application tabs.

## Motion refinement — 2026-10-20

User explicitly requested stronger overall motion and parallax. `LandingScrollEffects.tsx` owns scroll-linked Motion values (no React state per scroll), bounded IntersectionObserver/Web Animations reveals, hidden-document pause and cleanup. Hero and major evidence panels keep their normal document space. Static content remains readable without animation. The previous no-decoration and no-tab-underline preference still applies.


## Hero refinement — 2026-10-21

The editorial headline/proposition now precedes the full-width interactive reader. This supersedes the previous side-by-side hero and 450ms brief entrance; unused older CSS does not define the current composition. Preserve the no-decoration and no-tab-underline preference, labelled examples, bilingual controls, existing route destinations and supporting page behavior.

## Hero spacing — 2026-10-21

Separate the introductory copy and stock reader by 104px on desktop, 80px at tablet widths and 56px on phones. This breathing room also accommodates the opposing scroll-parallax offsets.
