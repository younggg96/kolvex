# Kolvex news production release

- PR: https://github.com/younggg96/kolvex/pull/31 (merged)
- Commit: 92229e7099afb60a3cdb5466c494acdd57b5f977
- Live page: https://kolvex.app/dashboard/news
- Vercel: dpl_kcAZ83tp36tVYbw3BX3qcZRzvfmh — READY, production alias attached
- Railway: ff22d74a-b551-4d93-886d-d77dc4ee2091 — SUCCESS
- Both deployment providers report this merge commit.

Production backend and Next.js proxy each returned HTTP 200, 100 headlines,
delivery=delayed, stale=false. Railway runtime request logs confirmed HTTP 200.
Browser error log was empty after backend release; the transient pre-backend
failure state recovered on Refresh.

Signed-in Chrome checks: desktop feed and details, equities and Focus filters,
search/no-results/clear and restored input focus, query restoration on reload,
bookmark persistence and removal, pause/resume, related SMCI link. Test bookmark
was removed and URL filters cleared after verification.

390x844 phone layout: document width and scroll width were both 390px. Drawer
showed source details and original link. Escape dismissed it and restored focus
to the headline trigger. Temporary viewport override was reset.

Screenshots: desktop-news.png, mobile-feed.png, mobile-detail.png.
Runtime captures use Chinese/dark mode. English/light-mode runtime checks and
broader accessibility coverage were not performed. Existing static audit issues
are described in docs/news-feed.md and the PR; no new production dependency,
secret or migration was introduced.
