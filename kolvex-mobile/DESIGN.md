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

`../kolvex-frontend-web-nextjs/app/globals.css` owns product colors. `src/lib/palette.ts` adapts those tokens to React Native and `src/lib/theme.ts` selects the system theme. `tests/theme-parity.test.ts` checks both themes against the Web source. Dark ground #000000, surface #0E0F10, foreground #FFFFFF, secondary #9BA0A6, border #282A2D, action #00C805, negative #FF5000. Light ground #FAFAF9, surface #FFFFFF, foreground #000000, secondary #5C5F63, border #E4E3DF, action #008503, negative #D63A00. Brand #00C805 is separate from text-safe action/positive color. Charts use Web chart-up #00C807 and chart-down #FF5100. Selection uses neutral secondary fills (#EBEBE8 / #1E2022), neutral borders and foreground text; it never uses a green wash. Glass/blur follows the explicit theme flag, independent of background hex values. `components/UI.tsx` owns Copy, Glass, Page, Button, Search, Failure and loading/empty states. Loading uses `LoadingStatus` (ActivityIndicator and text after 300ms, no placeholder blocks); rows with a known symbol stay real and use `PendingValue` for values in flight. System font for all roles; large title 36, price 48, section 20, body 16, metadata 12/14. Copy permits native text scaling.

24pt page padding and section gaps; 16pt rows; 8pt related elements. 24pt panels; at least 44pt interactive targets. Navigation and scrolling respect device safe areas. Content wraps, avoids fixed text heights and uses tabular numeric figures. Native scrollbars stay system owned.

## Behavior and platform variants

NativeTabs owns mobile navigation; Expo Router Stack owns stock detail/back navigation. Web uses a separate Tabs adapter solely for preview. Glass uses SwiftUI clear Liquid Glass through `native/SwiftGlass.ios.tsx` when iOS runtime availability is true, older iOS blur otherwise, and a solid semantic surface on Android/web. `native/SwiftButton.ios.tsx` owns actual SwiftUI glass/glassProminent controls; `native/DateField.ios.tsx` owns SwiftUI date selection. Reduce transparency selects opaque surfaces. No custom movement, so reduced motion does not require an animation variant. Interactive press feedback uses opacity and optional native haptics.

Chinese/English UI; securities and USD amounts retain market notation. Date-only source dates are never converted through local time. Demo quotes and chart are explicitly marked on every page; live failures never synthesize prices. No Japan-market scope. UI message coverage is generated and checked; source editorial prose is translated only when the API supplies a translation.

## Mobile 0.2 migration

Five stable tabs: Markets, Opinions, Research, Watchlist and More. The More hub owns account, briefs, news, chat and portfolio entry points. All keep the same glass, spacing, system typography and inline feedback. `UI.ListPage` is the virtualized counterpart of `UI.Page` for large news/watchlist feeds; `components/Content.tsx` owns authentication gates, fields, selectors, pagination, safe sources and native text rendering. No report HTML is executed.

Authentication is now implemented for password accounts, with encrypted native sessions and a separate ephemeral web-preview session. Authenticated watchlists are account-owned and do not silently import guest lists. Chinese remains the default UI locale; English application chrome is available through account/guest preferences. Native tabs/system dialogs keep platform behavior; no decorative navigation is substituted for a platform control.

## Mobile 0.3 native material and workspace ownership

`UI.Glass` owns reduced-transparency detection and platform fallback. On supported iOS it delegates to SwiftUI `glassEffect({ glass: { variant: "clear" } })`; RNHostView measures wrapped React Native content vertically, while Yoga owns outer placement/width and SwiftUI owns the material. Button and date picker use SwiftUI Host directly. Clear glass has no fake opaque background. Older systems remain readable through blur/solid fallback; no Web screenshot is evidence of native glass.

`CandleGraph` owns the native financial plot; copied pure indicator/range functions keep Web calculation semantics. Numeric/date anchor fields are the native drawing entry mechanism and allow precise, non-drag input. Explicit saves and conflict checks protect the cloud snapshot; this is not gesture-for-gesture replication of the Web canvas.

`PreferencesProvider` owns theme selection and per-account preference initialization. System/default, light and dark are explicit app variants. Native Appearance override affects only this application, including system chrome; the override is cleared on provider disposal. Selectors preserve their footprint while mutations are busy. New private screens reuse AuthGate, with inline boundaries for nested workspaces.

Chart viewport uses bounded horizontal pan and centered pinch with button alternatives. Message dictionaries cover static and dynamic UI labels; source names, user messages and editorial content bypass generic UI translation.
