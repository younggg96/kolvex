# Frontend read cache

The browser cache lives in `kolvex-frontend-web-nextjs/lib/clientCache.ts`, with
React state managed by `hooks/useCachedResource.ts`. It retains at most 160 keys
in memory for the current tab. It does not persist private responses or API keys
to disk, and it does not cache authenticated responses in a server module.
Existing portfolio snapshots retain their own session cache, cleared on account
changes. Closing or fully reloading the tab clears the new memory cache.

| Resource | Freshness window | Retained snapshot window |
| --- | --- | --- |
| Stock quotes, market quote batches | 15 seconds | 60 seconds |
| Price chart bars, daily market charts | 60 seconds | 5 minutes |
| Daily macro source history shared by cards and comparison tables | 5 minutes | 15 minutes |
| Market comparison snapshots | 5 minutes | 15 minutes |
| Market event calendar | 60 seconds | 5 minutes |
| Chat lists, conversation details and messages | 30 seconds | 60 seconds |
| Creator opinions, directory, research lists and published reports | 60 seconds | 15 minutes |
| Saved analysis metadata | 60 seconds | 15 minutes |
| Saved version payloads, creator profiles | 5 minutes | 15 minutes |
| Holdings and linked stock symbols | 30 seconds | 60 seconds |
| Brief issue and calendar data | 60 seconds | 15 minutes |
| Stock headlines | 60 seconds | 15 minutes |
| News terminal feed | 30 seconds | 5 minutes |
| Configured provider names (no key values) | 60 seconds | 60 seconds |
| Official macro indicators | 5 minutes | 15 minutes |

The windows control reuse on entry or revalidation, rather than imposing polling
on every mounted component. Existing visible-page polling remains for news;
stock hooks with an explicit refresh interval keep that interval. The chart
preview queue retains its viewport and concurrency limits.

Cache keys include the endpoint, ticker, filters, date range, page and scope as
applicable. Fresh reads skip the network; concurrent reads share a promise.
Expired readable snapshots refresh in the background. Cancelling one reader
never cancels a request needed by another reader. Shared requests have a default
20-second deadline, including loaders that ignore their abort signal.

Manual refresh bypasses the freshness window. Creator edits/imports invalidate
the creator namespace; research start/publish/unpublish/delete invalidates research
and analysis-history metadata; switching the current analysis invalidates that
stock's history. Brief saves invalidate brief readers and calendars. Portfolio
writes and existing portfolio synchronization actions invalidate holdings readers.
API key changes refresh provider names using the existing change event.

Changing the authenticated account clears snapshots and aborts old requests;
late replies cannot repopulate invalidated entries. Authorization failures and
missing resources remove snapshots. Other refresh failures preserve readable
content and expose the owning view's error/retry state. Job submissions, active
job polling, SSE, credentials and other mutations are not cached by this layer.

The stock workspace starts its quote, creator, holdings and published research
resources independently. A slow research response cannot delay the quote or
creator panel. The chart and creator panel share the same unfiltered opinion
request. Creator navigation commits the destination immediately, using a cached
snapshot when present, rather than waiting for a prefetch before navigating.

Verification: client-cache and cached-resource tests exercise cold and cached
mounts, stale refresh, request deduplication, forced refresh, cancellation, timeouts,
account isolation and late replies. Market quote tests verify per-symbol reuse
across different lists and network access after explicit refresh. Network request
counts are tested; no production latency percentage is claimed without traces.


## Cache coverage and refresh corrections

The calendar now uses the shared resource hook. Re-entering it within one minute
reuses its response; visibility/online events check freshness instead of forcing a
request. The visible calendar still checks its window every minute. Expired
snapshots refresh in the background and a failed refresh preserves readable data
with a localized status. Manual refresh bypasses freshness.

Raw FRED observations are keyed by source symbol, independently of derived chart
ranges. Cards and comparison rows share the same request. Comparison rows also
retain their assembled snapshot, so returning to list mode can paint immediately.
Raw OHLCV history caching now lives in `getStockHistory`, shared by price charts,
preview workers and any other history consumer. Its keys normalize symbols and
parameter order while retaining explicit start/end windows. The existing viewport
queue and its three-worker limit remain in place.

Market card/chart refresh attempts and overview quote retries are consumed once.
A previous refresh no longer makes every subsequent range or universe change
bypass fresh cache entries. Comparison retries now bypass the underlying trend
or FRED cache as well as the row cache. Fresh shared-hook mounts never advertise
a background refresh when no network request is needed.

Chat GETs share in-flight requests and retain responses in browser memory only.
Successful create/rename/delete/message writes invalidate the chat namespace.
Starting a stream and finishing its consumption (including parsing errors) also
invalidate it, preventing partial history from being retained after generation.
SSE requests themselves remain uncached. The existing account boundary clears
these private snapshots.

The related-creator opinion panel now shares the stock workspace cache. Changing
the excluded creator filters the same archive locally rather than refetching it.
YouTube API errors carry HTTP status so revoked/missing resources clear snapshots.

Existing caching was confirmed for creator dashboards/details, research lists,
analysis history, brief lists/calendars, stock quotes/news, macro indicators and
provider availability. Credential reads/writes, job status polling, SSE and remote
drawing synchronization retain their existing behavior. No blanket HTTP caching
was added to authenticated API routes.

This is a navigation/re-entry cache, not persistent offline storage: a full browser
reload still clears memory. First visits and expired entries still depend on the
upstream API. No production latency reduction is claimed without runtime traces.
