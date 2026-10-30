# Production release

- Date: 2026-10-29, America/Los_Angeles.
- Site: https://kolvex.app/dashboard
- Final commit: `adf8239957e9cefb9533b9cee224bd8ea8a1d789`.
- Vercel Production deployment: `7425773312`, reported success by the GitHub integration.
- Deployment URL: https://kolvex-6x51rftl8-guanggengyang.vercel.app

Release includes the nine stock-observation implementation/documentation files
from `ef22df1` and the two-file routing correction in `adf8239`. Unrelated pending
backend work and the separate StockWorkspace panel-title edit remain local.

The routing correction passes `null` to Next's patched native history API. Passing
the existing `__NA` state caused the framework to skip search-param synchronization.
A regression test exercises the installed Next adapter against the actual scope
button handler; its negative control rejects the old implementation. The release
passed 31 tests, TypeScript, scoped lint and an isolated production build.

Production checks:

- Homepage: HTTP 200.
- Dashboard: expected redirect to login for an anonymous visitor.
- Five cross-sector quotes: HTTP 200, five valid positive prices.
- Creator dashboard: HTTP 200, 236 stocks with recent-window fields.
- The custom domain serves CSS containing the new observation-grid and evidence-link
  selectors. The homepage's unchanged marketing JavaScript is not a release failure.
- A local build's dashboard chunk filename returned 404 in production, where asset
  hashes differ; this probe does not establish an application error. Release identity
  comes from the successful production deployment for the final commit.

The Vercel connector could list projects but could not read this team's project
details, and the local CLI had no credentials. Deployment used the existing authorized
GitHub main-branch integration. No credentials or access controls were changed.
Runtime error logs and a signed-in browser flow were not verified.

Machine-readable evidence: `deployment.json`. Release logs: `release-tests.log`,
`release-build.log`.
