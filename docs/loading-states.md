# Content loading states

Web initial reads use `ContentLoading` from `components/ui/content-loading.tsx`: a small
Loader2 and one localized status line. It fades in after 300ms using CSS only, so fast
reads show nothing and no timers are added. Dashboard route loading, YouTube, Reddit,
X, news, daily briefs, profile/settings, admin lists, conversations, autocomplete,
investment transactions, Watchlist, stock observation and research lists all use it.

Rows that already know their name or ticker render as real rows. Quote and metric
values still in flight use `PendingValue`, a short line distinct from the "—" of
missing data. This covers Watchlist, the Market Watchlist card, stock observation,
Market comparison and the peers table.

Mobile mirrors both in `components/UI.tsx`: `LoadingStatus` waits 300ms before showing
ActivityIndicator and text, and `QuoteRow` uses `PendingValue` for its price and change.

Specialized chart, financial, portfolio and research detail skeletons are retained.
Cached content stays visible during revalidation. Buttons for save/import/delete,
load-more, translation, authentication processing, AI generation/streaming and account
syncing keep explicit operation progress.
