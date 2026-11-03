# Mobile migration verification

## Latest status — Mobile 0.4, 2026-11-02

| Level                              | Result                                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Code implemented                   | See `MIGRATION.md`.                                                                                     |
| Type check, lint, format, i18n     | Pass.                                                                                                   |
| Unit and contract tests            | 75 of 75 pass.                                                                                          |
| Expo Doctor                        | 20 of 20 pass.                                                                                          |
| iOS and Android bundles            | Metro/Hermes exports pass. **This is not a native compile.**                                            |
| React Native Web preview at 390 px | Exercised with real data, below. **Not native acceptance.**                                             |
| Native run on iOS                  | **Started, partial.** See the iOS simulator run below.                                                  |
| Native run on Android              | **Not done.** Set aside at the owner's request.                                                         |
| Real signed-in or mutating flows   | **Not done.** No test account. No sign-in, AI run, save, upload, role change or deletion was performed. |

### iOS simulator run (iPhone 17 Pro, iOS 26.0 runtime, Xcode 26.6)

Native Swift/Xcode compile and launch succeeded, against the local read-only backend through Metro.

Seen working natively with real data, signed out:

- All five tabs, with the system glass tab bar.
- Stock detail, Ownership (Form 4), the Peers table.
- Technical chart: horizontal pan moved the window from 2026-08-10–11-02 to 2026-06-18–09-14; pinch reduced it to 15 bars.
- Research report in dark theme, translate toggle, system share sheet, Markdown export (131 KB).
- Creator profile, share sheet, image capture through `react-native-view-shot` (439 KB PNG).
- `kolvex://` links for stock, technical, report, preferences, account and `share/creators`.
- Light and dark themes through the system setting; English settings and account screens.
- Sign-in form accepting input, with nothing submitted.

Native-only defects found and fixed:

| Defect                                                                                                                  | Fix                                                                      |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Horizontal chart drag popped the screen through iOS 26's full-screen back gesture                                       | `gestureEnabled: false` on the technical screen; the back button remains |
| `MutationStatus` rendered a bare space, a red error on every form using it, including sign-in. Existed before this work | Removed; `native-text-contract` now catches one-line spaces              |
| `{text && <View />}` throws on an empty string, reachable with the empty default drawing label                          | 31 guards converted to `!!`; a new contract test covers this pattern     |
| `(tabs)` back label                                                                                                     | Minimal back button                                                      |
| Content under the status bar on tab screens                                                                             | Opaque status-area scrim                                                 |
| 73pt filter buttons with a gray band                                                                                    | Plain chips                                                              |
| Raw ISO time on the selected bar                                                                                        | Date, or date and time for intraday                                      |
| Stacked full-width navigation buttons on Markets and Opinions                                                           | Grouped rows                                                             |
| Timestamp in export file names; share actions below long previews                                                       | Web-style names; actions first                                           |

Open on iOS:

- Tab labels on never-visited tabs sit low and clip until the tab is first opened. Cause not established; it may come from running a 26.5 SDK build on the 26.0 runtime.
- `https://kolvex.app` links open Safari until universal links are configured.
- The software keyboard did not appear because the simulator uses the hardware keyboard, so keyboard avoidance is unverified.
- Whether search and action bars render real glass was not confirmed by inspection.
- Not exercised natively: signed-in flows, draw-on-chart (needs sign-in), 13F, long-term financials, earnings, news, briefs, chat, admin, Dynamic Type, VoiceOver, Reduce Transparency, small screens, iOS 18 fallback.

`expo run:ios` currently fails: Xcode 26.6 reports no destinations because the iOS 26.5 platform component is not installed (about 8 GB, with 10 GB free). The build used instead, from `ios/`, compiles `Pods/Pods.xcodeproj -alltargets`, then `Kolvex.xcodeproj -target Kolvex`, with `-sdk iphonesimulator ARCHS=arm64 CODE_SIGN_STYLE=Manual CODE_SIGN_IDENTITY=- SYMROOT=$PWD/build-sim/Products OBJROOT=$PWD/build-sim/Intermediates`. Do not delete `ios/build`: it holds codegen from `pod install`.

### Login is required (no guest mode)

At the owner's request the app has no signed-out experience. Signed out, only `sign-in`, `auth/callback` and `auth/recovery` are reachable; every other route is inside `Stack.Protected`. Guest watchlist and public research reads were removed.

- Simulator: cold start lands on sign-in with no tab bar. `kolvex://stock/AAPL` and `kolvex://admin` stay on sign-in. The language choice survives a cold start.
- `tests/auth-guard.test.ts` walks every route file under `src/app`, because `Stack.Protected` does not cover a route with no declared screen.
- A signed-out deep link is dropped rather than resumed after signing in.
- Local lists saved under `kolvex.mobile.watchlist` by earlier builds are no longer read or merged.
- Unexplained: the sign-in screen once showed Chinese after English had been chosen, following hot reloads. It did not recur across a cold start.

### Signed-in pass (owner's account, read-only)

The owner signed in on the simulator. This is a real, non-admin, free-tier account, so nothing was written with it: no watchlist, drawing, profile, preference, chat or research changes.

| Check                     | Result                                                                                                                                                                                                                |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign-in                   | **Passed**, performed by the owner. The account's language and theme applied.                                                                                                                                         |
| Session restore           | **Passed** across cold starts, before and after removing the deprecated `lock` option.                                                                                                                                |
| Sign-out                  | **Passed**: returns to sign-in, shows the device's own language and theme, not the account's.                                                                                                                         |
| Read paths with live data | **Passed**: Markets, cloud watchlist, briefs list and reader, news with translated headlines, macro, calendar, updates, research library, opinions, account, preferences, NVDA stock and financials, technical chart. |
| Permission gates          | **Passed** for a non-admin: `/admin` and `/research-tasks` refuse with a message. Admin success paths remain unverified.                                                                                              |
| Empty state               | Chat list with no conversations.                                                                                                                                                                                      |
| OAuth start               | Reaches the system consent prompt without the plain-PKCE warning; cancelling returns to sign-in. The S256 parameter was not read from the URL, and OAuth return was not completed.                                    |

Backend logged no 4xx or 5xx during the pass. Opening News runs the Web's automatic headline translation, which may use a paid model on the server.

Fixed from this pass:

- Macro showed raw `daily · ready` and diverged from the Web's precision and signs (`4.7%` against `4.70%`, `-5 bp` against `−5.00 bp`). Formatting is now copied from the Web and checked by test, with its frequency, comparison, method and status wording.
- Calendar showed raw `tbd · medium · published`, ignored English titles and summaries, and stacked tickers one per row. It now uses the Web's event time, category, high-impact and trending labels.
- PKCE fell back to plain because Hermes lacks WebCrypto; `expo-crypto` now backs it.
- A signed-in cold start stayed in the system theme until `/users/me` answered, because the account's preferences were never cached. Another account's choices could also carry over after sign-out.

Open:

- **Tab labels sit low and clip on tabs not yet opened in this launch, on every launch.** Not fixed; cause unknown.
- A tap on the tab bar and one `kolvex://preferences` link were each ignored once right after launch or navigation, then worked. Not reproduced on demand.
- The launch screen is blank in the system theme for several seconds in the dev build. Release timing not measured.
- Not exercised: every write path, chat send, draw-on-chart, English while signed in, and 13F, earnings and report reading in this pass.

### Blockers

- Android: set aside for now; requires a JDK and Android SDK with an emulator.
- **Write paths behind sign-in: require a non-production or disposable test account**, and an administrator account for `/admin`.
- Universal links: requires the Apple Team ID and hosted association files.
- `react-native-view-shot` was added, so the next run needs a new development build; Expo Go will not do.

### Live data checks (local backend, read-only)

The local backend ran on port 8082 with `CHART_WORKER_ENABLED=false` and `ECONOMIC_INDICATORS_WORKER_ENABLED=false`, so it could not consume paid AI jobs or write indicators. `ALLOWED_ORIGINS` was overridden for that process only, to admit the preview.

- 200: free-research `financials`, `filings`, `insiders`, `revenue-outlook` for AAPL; `institutions`, `institutions/berkshire`; `market/overview`; `^GSPC` history; `trading-analysis/public/list`; creator `latest-video`.
- 404 for `ZZZZZ` financials. The screen shows an empty state, not a failure.

### Web comparison

The signed-in Web dashboard was not compared, because it redirects to sign-in without an account. The local Web server on port 3000 also lacks the free-research route, so it appears to predate that work. Instead, the public route at `kolvex.app` was compared with the mobile backend source using `fetched_at`-stripped payloads:

- AAPL filings, insiders, revenue outlook and Berkshire 13F: identical.
- AAPL financials: a serialized comparison first reported a difference, but a field-by-field diff found none.
- NVDA financials: the same serialized comparison reported a difference. **It was not re-checked field by field.**

The same mobile-side formulas gave AAPL FY2025 revenue 416.16B, growth 6.43%, FCF margin 23.73%, ROE 151.91%, liabilities/equity 3.87. These were computed with `freeResearch.ts`, which is AST-identical to the Web file, but were not read off a rendered Web page.

### RN-Web preview walkthrough

Checked: AAPL ownership (38 Form 4 rows, totals), NVDA peers with AMD and TSM (TSM's P/S and EV/EBITDA hidden for mixed currency), AAPL earnings materials, long-term financials in English and light theme, research groups and report actions, updates, creators tab distribution (55 AAPL opinions, matching `/youtube-opinions/stocks/AAPL`), `/portfolio` redirecting to Markets, and an unknown ticker's empty state.

Not checked in the preview: the 13F investor view, translate toggle, draw-on-chart, share sheet, image capture, and the multicharts and stock research tabs. Cross-origin translation in a browser is not representative of native.

Defects found this way and fixed: compact digit grouping (caught by comparing with `Intl`), overlapping chart dates on long histories, truncated table dates, untranslated strength phrases and "latest" label, literal `---` in reports, and a previous-to-current strength row with no arrow.

Known preview noise: a development warning about `accessible={false}` on SVG comes from the Web adapter.

Screenshots: `artifacts/mobile-v04-*-rnweb.jpg` are React Native Web; `artifacts/mobile-v04-ios26-*.png` are the iOS simulator.

### New automated coverage

`tests/free-research.test.ts`: compact numbers against `Intl`, percent and date formats, research grouping and incomplete catalogs, deep links including the disabled Portfolio and a traversal attempt, touch-to-price geometry, report export order, translation identifier protection, strength thresholds and English coverage, share content, and the Web feature flag. `web-source-parity` now also covers `freeResearch.ts` and `opinionDates.ts`.

## Earlier records

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
