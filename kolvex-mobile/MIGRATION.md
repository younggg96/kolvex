# Mobile creation decision

Observed repository inventory: web client at `../kolvex-frontend-web-nextjs`, FastAPI at `../kolvex-backend-py`; no native iOS/Android project, installed-user continuity artifacts or native release pipeline were found. External native clients are unknown. This is a new sibling client requested by the user, not replacement of a verified native app. The tagged migration skill informed inventory; its read-only migration-decision workflow is not evidence of completed product-wide migration.

Selected implementation: independent Expo / React Native client, preserving web and backend. No brownfield host exists in accessible sources; no existing native app is retired. Reuse HTTP contracts, not DOM components. SDK versions are fixed by the package lock and Expo dependency resolver. Business ROI, staffing and release deadlines are unknown; no estimated cost savings are claimed.

First vertical slices: market → stock → daily chart; source-attributed public creator opinions; persist a local watchlist across app restarts. Native boundary: system tabs plus runtime-gated native glass. Authentication, session continuity, cloud self-selected stocks, portfolio, AI chat/research, push and production distribution need independent follow-up implementation and verification.

Acceptance before native distribution: build with full Xcode and Android SDK; verify iOS 26 glass and earlier fallback, Android fallback, VoiceOver/TalkBack, large text, reduce transparency, dark theme, gesture back, offline/retry, real FastAPI success and error, and local persistence. Exporting Metro bundles does not satisfy these device checks.
