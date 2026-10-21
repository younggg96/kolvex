# Automatic news language release

Feature PR: https://github.com/younggg96/kolvex/pull/33
Translation recovery PR: https://github.com/younggg96/kolvex/pull/34
Final main commit: 6254d32b7b291f3fd8d152f3540a3465eb755e8b
Vercel: dpl_355HvGzRDmDiRijAU6FJ43nmut2e — READY, kolvex.app alias attached
Railway: a74fb289-eb86-479b-8651-b6bdea4127a3 — SUCCESS

Validation: 11 news/translation regressions, TypeScript, targeted lint, local
production builds and both PR GitHub CI runs passed. DESIGN lint has zero errors;
three pre-existing Settings/global-scrollbar static findings remain unchanged.

Production signed-in Chrome verification:
- Chinese UI automatically translated the displayed 40/40 headlines with no row
  buttons, no bookmarks and one page heading. Confirmed after a fresh reload
  without clicking translation or retry controls.
- Changed the actual Settings language to English: 40 English source headlines,
  zero Chinese translation links. Changed back to Chinese and restored the user's
  preference before finishing.
- The previously persistently failing UK Core CPI headline returned HTTP 200 with
  valid Chinese output after the bounded no-store retry fix.
- At 390x844, document width and scroll width were both 390; row buttons=0 and
  heading count=1. Temporary viewport override was reset.
- Expanding to 80 rows automatically started additional translations, but upstream
  failures left some in the original language (45/80 translated in that check).
  The page retained all headlines and showed its unified retry state. The default
  40-row window was restored and again completed 40/40 with no failure state.

Screenshots: chinese-desktop.png, english-desktop.png, chinese-mobile.png.
Preview API testing was blocked by the existing Vercel connector grant; final
verification used the authorized production endpoint. No permissions changed.
