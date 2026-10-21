# News simplification and translation

PR: https://github.com/younggg96/kolvex/pull/32
Merge commit: 061ba1807cebec5d70f25c1645d6eb76737ab1bb
Production URL: https://kolvex.app/dashboard/news
Vercel production deployment: dpl_Q4jQs2KPRowxg5XvrGAy812bwn5K (READY)

Validation:
- 8 frontend news regression tests passed; includes explicit translation, cache
  switching, failure/retry, and source-change/unmount cancellation.
- TypeScript and targeted lint passed. Production build and GitHub CI succeeded.
- DESIGN lint: zero errors, seven existing token-reference warnings.
- Strict UI audit retains the same three pre-existing Settings/scrollbar findings.
- Production /api/news: HTTP 200, 100 headlines, stale=false.
- Existing /api/translate: HTTP 200 with a real Chinese translation.

Signed-in Chrome, Chinese/dark theme:
- At 1440px, exactly one h1 ('新闻终端'), no search input, and no visible source
  tags, category labels, Focus rules, details or related-symbol UI.
- First real headline translated into Chinese. Original action restored the exact
  source text; toggling again reused the translation.
- At 390x844, h1 count=1, document width=scroll width=390 and no detail dialog.
- A second actual headline translated successfully using the phone UI.
- Browser error log was empty. Viewport override was reset after verification.

Screenshots: desktop-translated.png and mobile-translated.png.
English/light-theme runtime checks were not performed; shared translation and
UI primitives are unchanged. No backend, dependency or environment modifications.

Automatic Railway deployment fbfc63a3-4472-4826-8a4c-00050612b6e7 also completed
SUCCESS on the same merge commit; backend source itself is unchanged.
