# Reddit feature verification — 2026-10-29

Implemented in the existing Next.js app. Existing YouTube/Reddit sidebar links were verified and retained. Five allowlisted ApeWisdom community filters, four descending sort modes, $-prefix ticker/name search with clear-and-focus, browser-local follows and following-only view use the current top-100 source list. Missing comparison values sort last. Community-specific server/browser caches and matching response scopes prevent mixed rankings.

## Passed checks

- `node --test scripts/reddit-opinions.test.cjs scripts/cached-resource.test.cjs`: 17/17 pass.
- `npx tsc --noEmit --incremental false`: pass.
- Scoped `next lint` for page, API, ranking utilities and watchlist hook: pass without warnings.
- `npm run build`: final production build passed after the toolbar fix; output in `build.log`. Existing Supabase Edge-runtime compatibility and VideoPlayer img warnings remain unrelated to this change.
- `git diff --check`: pass.
- Live same-origin APIs for all-stocks, wallstreetbets, stocks, investing and options returned matching communities and real provider rows. Unsupported community requests are covered by rejection tests.
- Impeccable detector: `design-detector.json` is empty. Independent finish review: `ship`; 768px English toolbar overflow resolved.

## Browser evidence

A separate local component harness at http://127.0.0.1:3006 renders the actual changed Page, DashboardLayout, LanguageProvider and shared components. Only Next routing/image adapters are substituted; API calls proxy to the real local Next server. The banner identifies the preview. This harness is temporary tooling under /tmp/kolvex-reddit-preview, outside application routes and authentication.

Exercised community changes, sort order, $-ticker search, empty search and recovery, follow-only intersection, persistence after reload, native disclosure by keyboard, mobile follow, clear button focus, initial loading, injected 502 initial/refresh errors and successful retry. Refresh errors retain current-community rows and timestamp. Viewports: 390, 768 and 1440px; Chinese/English and light/dark themes. Toolbar bounds verified at 768px: search32–736, community32–289, sort301–558, follow570–736. Responsive table scroll remains local to its focusable region.

Screenshots: desktop.png, desktop-en-dark.png, mobile.png, mobile-dark.png, tablet-en.png; `mobile-en-dark-fresh.jpg` is the reviewed authoritative English mobile screenshot. Earlier IAB reused-frame exports were superseded by a fresh-tab capture; no UI change was needed for those export artifacts.

## Limits and scoped audit

The full application redirects to login without a session. Full authenticated AppShell/auth behavior was not end-to-end verified. No deployment was requested or performed. Follows are browser/device-local, not account-synced; historical time series require future snapshot collection and are not fabricated.

The broad Premium static audit is recorded in premium-audit.json and is not a passing repository-wide audit: it flags the authored Radix Select as a native select (false positive; implementation imports components/ui/select.tsx), plus pre-existing Settings ownership/action and global-scrollbar findings outside this task. These do not establish runtime faults in the changed workflow; no unrelated application files were altered to silence them.
