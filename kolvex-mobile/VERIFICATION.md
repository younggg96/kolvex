# Mobile migration verification — 2026-11-01

## Code and packaging

- `npm run typecheck` and `npm run lint`: passed.
- `npm test`: 32 tests passed. Covers public/private request contracts, absent login, account changes during requests, non-replayed mutations, encrypted session chunk integrity/Unicode/failure/sign-out, explicit demo semantics, safe source links, SSE fragmentation/EOF/errors/stop after headers, earnings outcome and unit normalization, financial period ordering/growth/CSV/compact numbers. Four color checks compare light/dark native tokens against the Web CSS source and validate AA text contrast on the actual reading/control surfaces.
- `npx expo-doctor`: 20/20 passed after SecureStore and Supabase dependencies were installed.
- iOS / Android Metro-Hermes and Web exports: passed. Bundle export does not establish native Xcode/Gradle compilation.
- `designmd lint DESIGN.md`: zero errors; documentation token warnings remain.
- Premium static audit output is in `premium-audit.json`. Actionless-button findings are HTML-checker false positives: it recognizes onClick, but these React Native controls require and receive onPress. The audit is not claimed as clean.
- npm installation reports existing moderate transitive advisories. This work did not perform an unrelated major dependency upgrade.

## Live service boundaries

Using the existing local backend and public client configuration (no values committed):

- `/market/quote/AAPL`: 200.
- `/youtube-opinions/dashboard?limit=1`: 200 with a real attributed opinion.
- `/x-content/posts?limit=1`: 200 with real source content.
- `/news/feed`: 200 with 100 delayed articles.
- `/reddit-opinions?community=all-stocks` and `community=stocks`: 200 with 100 rows and actual fetch time after adding the fixed upstream proxy.
- `/market/income-statement/AAPL`: 200 with four annual rows; quarterly statement reading was verified in the browser.
- Unauthenticated `/briefs`, `/portfolio/holdings` and `/chat/conversations`: 401.
- Supabase `user_watchlist` read with the anonymous client key and no session: 401.

The Reddit browser failure from directly calling ApeWisdom was reproduced and fixed by reading the new allowlisted FastAPI proxy. No CORS protections or database grants were relaxed. The unchanged older backend process was left alone; an updated local instance was started on 8082 for verification. The isolated Web preview on 8093 uses a local same-origin proxy because another project now occupies 3001.

## Backend checks

`venv/bin/python -m unittest discover -s tests -p test_reddit_opinions.py`: 6 tests passed, covering source validation, zero/missing baselines, coalesced cache reads, TTL/community separation, arbitrary-community rejection, route validation and sanitized upstream failure. Existing financial serialization checks: 4 tests passed.

## Browser coverage

React Native Web preview at phone width 390px:

- Real quote rows; YouTube source/filter/page UI; real X author/text/source content.
- Reddit real ranking after proxy fix, with fetch time and comparison values.
- Private Research screen leads to the account gate without fetching private content.
- Empty login submission validates locally; password input renders as type=password. No real account was created or signed in.
- Stock annual/quarterly financial reports, chart/list switch, exact source values and reporting currency; real EPS comparisons and analyst target/rating data. CSV sharing code exists but no external share was submitted.
- Direct stock deep link exposes a working back destination. Horizontal filter bars retain swipe navigation without desktop scroll tracks. Screenshot: `artifacts/mobile-v02-financials.jpg`.

Earlier 0.1 checks established visitor-watchlist add/read/reload/remove behavior. The 0.2 account-watchlist path uses existing RLS and was checked through code/negative transport tests; authenticated cross-device success was not exercised.

## Outstanding acceptance

No full Xcode/simctl or native test device is available on this host. Native glass, Keychain/Keystore persistence, system sharing, Dynamic Type, VoiceOver/TalkBack, hardware/gesture back and device keyboard behavior need iOS/Android evidence. No test-account credentials were supplied, so successful authentication, real cloud watchlist changes, private briefs/report/portfolio reading and real AI sends remain authenticated acceptance checks. No real AI question, brokerage mutation or trade was submitted.

Advanced chart/drawing, native Plaid authorization, full bilingual UI and other remaining feature parity are tracked in MIGRATION.md. This is not a store-release or full-web-parity claim.

## Web color alignment — 2026-11-01

- Canonical source: `../kolvex-frontend-web-nextjs/app/globals.css`; native adapter: `src/lib/palette.ts`. Both themes match background/card/text/muted/border/primary/positive/negative/secondary/chart roles. Direction text uses text-safe tokens; chart marks use chart tokens. Selected controls use neutral fills and foreground text.
- Fixed the older-iOS blur theme check to use the theme flag rather than a retired background hex. Native glass remains platform-owned.
- 390px Web preview: visually checked Markets and Opinions with real data in the system dark theme; neutral selectors, grey card surfaces, green active navigation and orange-red declines. Screenshot: `artifacts/mobile-web-colors-dark.jpg`. Light tokens and text contrast are covered automatically; light runtime visual acceptance was not performed.
- Typecheck, lint, formatting, all 32 tests and iOS/Android/Web bundle exports passed. DESIGN lint reports zero errors and seven documentation token warnings. The refreshed premium audit reports 27 existing HTML-style actionless-button false positives for native onPress; it is not clean.
- `agent-device` is not installed, `simctl` is unavailable under the Command Line Tools installation, and no Android adb target is available. Device-level glass and native light/dark appearance remain unverified; no device session was claimed.

## Mobile 0.3 parity expansion — 2026-11-01

Implementation checks: TypeScript, Expo lint, Prettier and 55 Node/transport/calculation/static-contract tests pass. The additional tests include an AST contract preventing raw text/space nodes outside native text owners and AST comparisons with current Web model/catalogue/range/indicator sources. They also cover source-reader paths, public/private bearer boundaries, If-Match, multipart transport, macro units, invalid OHLC/volume/calendar dates and EMA/Bollinger/RSI/MACD/KDJ/VWAP semantics. Model IDs and pure technical/range algorithms were copied from the existing Web source rather than independently redefined. Expo Doctor: 20/20. Updated iOS/Android Metro-Hermes and Web exports passed; no native Swift/Xcode/Gradle compilation is claimed.

The FRED adapter adds four backend tests for allowlisting, date/header validity, duplicate ordering and preserving true zero/negative observations. Those four and the existing six Reddit tests pass. A live local `DGS2` request returned 200 with 505 observations. Live YouTube catalogue, videos, creator profile/history, X creator list and AAPL options contracts returned 200. No account credentials, API key values or private account responses are recorded in this report.

Browser preview at 390px: real creator directory/profile/history and source detail; native SVG OHLC, prior-bar selection, 30/60/120-bar window controls and RSI/MACD/KDJ selector; light app appearance, readable neutral selection and protected inline model/drawing boundaries. Browser preview tests the React Native Web adapter, not SwiftUI material, native hit testing or date-picker sizing. Final screenshots are in `artifacts/mobile-v03-*`.

Native material now uses `@expo/ui/swift-ui` Host/Group/RNHostView with `glassEffect` clear variant on supported iOS, actual SwiftUI glass buttons and SwiftUI DatePicker. Width/placement stays in Yoga and hosted content measures vertically. Reduced transparency retains opaque cards; older iOS retains blur. These native layout/keyboard/accessibility paths remain device acceptance, since Xcode/simctl and a native device are unavailable.

New write UIs were verified by contracts/guards and static inspection, not by production writes: no actual AI run, OAuth sign-in, recovery email/password update, key save/delete, avatar upload, role change, brief/source import, drawing save or destructive action was performed. Native OAuth requires configured providers and the callback allowlist. Native freehand drawing gestures and dormant native Plaid/portfolio features remain explicitly listed in MIGRATION.md. UI locale coverage and chart window pan/pinch math have automated checks; real multitouch remains a device acceptance check. Consequently this is a substantial implementation expansion, not a claim that every Web feature is fully accepted on iOS/Android.

Final 0.3 evidence: light-theme Markets and technical chart previews were exercised at phone width; selecting a prior candle, zooming to 30 bars and changing oscillator changed the visible values. Cross-asset reads included real DGS2/DGS10/credit spread data with percentage-point units. Protected macro/admin/drawings/key/calendar endpoints returned 401 without a session. The static premium audit retains 73 `affordance.actionless-button` findings from its HTML matcher; an AST scan found all 127 literal native Button nodes have onPress handlers. The audit is not claimed clean. The design-document lint remains zero errors / seven warnings.

Final locale/gesture check: the English preference changed the stack header, page labels, filters and account gate. A horizontal drag changed the 60-bar interval from 2026-08-07–2026-10-30 to 2026-06-29–2026-09-22 and updated the selected OHLC/indicator values. Light English technical and dark Chinese Markets screenshots are stored in `artifacts/mobile-v03-*`; they show the React Native Web adapter, not the iOS SwiftUI renderer. The 55-test total includes four bounded pan/pinch window tests and five locale/coverage tests.
