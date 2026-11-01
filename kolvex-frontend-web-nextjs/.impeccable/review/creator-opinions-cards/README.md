# Creator Opinions — canonical card layout

Captured 2026-11-01 02:48–02:49 America/Los_Angeles from the local Next.js dev server
(`http://localhost:3000`) at commit `341b799` plus the working-tree changes in
`components/youtube/YouTubeOpinionExplorer.tsx`, `components/youtube/VideoOpinionCard.tsx`,
`components/ui/list-card.tsx` and `DESIGN.md`.

Routes:
- `/dashboard/youtube-opinions?tab=creators` (tracked creators directory)
- `/dashboard/youtube-opinions` (stocks discussed directory)

Viewports: 1440×900 (desktop, dark and light, zh-CN) and 390×844 @2x (mobile, dark).
Account: a temporary local review user (deleted after capture); no production data was modified.

The page follows the Markets stock-watch reference: one 24px list card with tone
pills, a full-width search and the sort Select, the displayed/filtered count and
list rule, a column header, then 80px hover rows without per-row dividers. The
right rail's latest-video and holdings modules and the recent-changes module use
the same card bodies below their headings.

Verification: `tsc --noEmit` and ESLint pass; the youtube-dashboard-cache,
creator-share-ui, loading-states, decision-regressions and public-reading scripts
pass; tone filter, sort, search, tab switch and row navigation were exercised in
Playwright with no page errors.
