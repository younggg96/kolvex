# Content loading skeletons

Initial reads now use the shared `components/ui/content-skeleton.tsx` and existing
Skeleton primitive. Converted surfaces: YouTube directories/changes/videos,
creator profile and share-data reads, Reddit, X, news, daily briefs, profile/settings,
API provider availability, admin permissions and content lists, conversation lists,
autocomplete, investment transactions/privacy settings, Watchlist account feedback,
analysis/drawing history and supplementary stock metrics.

Five layouts cover list rows, compact video/opinion groups, text feeds, full articles
and profile forms. Existing specialized financial, chart, portfolio and research
skeletons are retained. Skeleton blocks have one status label, hidden decorative
shapes and reduced-motion support. They introduce no network requests or timers.

Cached content stays visible during revalidation. Buttons for save/import/delete,
load-more, translation, authentication processing, AI generation/streaming and
account syncing keep explicit operation progress. The unused legacy LoadingSpinner
component has no runtime callers and was not changed.

Verification: targeted TypeScript/lint checks, 62 existing cache/feed/history/brief
regressions, desktop and 390px browser previews with pending catalogue requests.
The three YouTube areas render skeletons without a spinner or horizontal overflow.
Temporary preview routes and request fixtures are removed before delivery.
