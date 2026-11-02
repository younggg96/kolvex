---
version: alpha
name: Kolvex Mobile
description: Chinese equity research in a native iOS reading interface with restrained glass surfaces.
colors:
  primary: "#00C805"
  action: "#008503"
  background: "#FAFAF9"
  surface: "#FFFFFF"
  foreground: "#000000"
  muted: "#5C5F63"
  border: "#E4E3DF"
  negative: "#D63A00"
typography:
  sans:
    fontFamily: system-ui
rounded:
  panel: 24px
spacing:
  page: 24px
  row: 16px
components:
  glass-surface:
    description: Native glass when available, solid when transparency is reduced.
  stock-row:
    description: Ticker and company beside tabular quote and signed change.
---

# Direction

Chinese-speaking US equity researchers checking prices and attributable creator opinions on a phone. Product UI, not marketing. Preserve the web client's green identity, Chinese content, signed directional figures and source links. The user's requested SwiftUI glass direction governs the native visual variant. System typography replaces web Inter; no bundled decorative fonts.

Signature: neutral stock identifiers and signed green/orange direction on quiet surfaces beneath iOS native glass navigation. Glass is restrained to containers and system chrome, with readable text at all times. Avoid decorative gradients, fake performance claims, fabricated creators and excessive animation. Brand green remains #00C805; smaller action text uses the text-safe positive token through `src/lib/theme.ts`. Stack titles and back controls use the foreground color; active tab navigation retains the text-safe green.

## Runtime ownership

`../kolvex-frontend-web-nextjs/app/globals.css` owns product colors. `src/lib/palette.ts` adapts those tokens to React Native and `src/lib/theme.ts` selects the system theme. `tests/theme-parity.test.ts` checks both themes against the Web source. Dark ground #000000, surface #0E0F10, foreground #FFFFFF, secondary #9BA0A6, border #282A2D, action #00C805, negative #FF5000. Light ground #FAFAF9, surface #FFFFFF, foreground #000000, secondary #5C5F63, border #E4E3DF, action #008503, negative #D63A00. Brand #00C805 is separate from text-safe action/positive color. Charts use Web chart-up #00C807 and chart-down #FF5100. Selection uses neutral secondary fills (#EBEBE8 / #1E2022), neutral borders and foreground text; it never uses a green wash. Glass/blur follows the explicit theme flag, independent of background hex values. `components/UI.tsx` owns Copy, Glass, Page, Button, Search, Failure and loading/empty states. System font for all roles; large title 36, price 48, section 20, body 16, metadata 12/14. Copy permits native text scaling.

24pt page padding and section gaps; 16pt rows; 8pt related elements. 24pt panels; at least 44pt interactive targets. Navigation and scrolling respect device safe areas. Content wraps, avoids fixed text heights and uses tabular numeric figures. Native scrollbars stay system owned.

## Behavior and platform variants

NativeTabs owns mobile navigation; Expo Router Stack owns stock detail/back navigation. Web uses a separate Tabs adapter solely for preview. Glass uses native Liquid Glass when runtime availability is true, older iOS blur otherwise, solid surface on Android/web. Reduce transparency selects opaque surfaces. No custom movement, so reduced motion does not require an animation variant. Interactive press feedback uses opacity and optional native haptics.

Chinese-only initial UI; securities and USD amounts retain market notation. Date-only source dates are never converted through local time. Demo quotes and chart are explicitly marked on every page; live failures never synthesize prices. No Japan-market scope. English locale parity and authentication migration remain future work.

## Mobile 0.2 migration

Five stable tabs: Markets, Opinions, Research, Watchlist and More. The More hub owns account, briefs, news, chat and portfolio entry points. All keep the same glass, spacing, system typography and inline feedback. `UI.ListPage` is the virtualized counterpart of `UI.Page` for large news/watchlist feeds; `components/Content.tsx` owns authentication gates, fields, selectors, pagination, safe sources and native text rendering. No report HTML is executed.

Authentication is now implemented for password accounts, with encrypted native sessions and a separate ephemeral web-preview session. Authenticated watchlists are account-owned and do not silently import guest lists. Chinese remains the first UI locale; full English parity is still pending. Native tabs/system dialogs keep platform behavior; no decorative navigation is substituted for a platform control.
