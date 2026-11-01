# Mobile migration verification — 2026-11-01

## Code and packaging

- `npm run typecheck` and `npm run lint`: passed.
- `npm test`: 28 tests passed. Covers public/private request contracts, absent login, account changes during requests, non-replayed mutations, encrypted session chunk integrity/Unicode/failure/sign-out, explicit demo semantics, safe source links, SSE fragmentation/EOF/errors/stop after headers, earnings outcome and unit normalization, financial period ordering/growth/CSV/compact numbers.
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
