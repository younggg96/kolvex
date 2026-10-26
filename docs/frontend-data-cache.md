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
| Daily macro source charts | 5 minutes | 5 minutes |
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
