# Kolvex investment decision workspace

Kolvex brings creator opinions, market structure, AI research and real holdings into a ticker-based investment decision workspace. The product outcome is: **Know why you own a stock. Know when that reason changes.**

## Information architecture

| Destination | Route | User's task |
| --- | --- | --- |
| Public home | `/` | Explore one illustrative NVDA decision, from research through review |
| Markets | `/dashboard` | Default entry: inspect stock quotes and benchmark ETFs; switch between selected stocks, holdings and creator coverage |
| Research | `/dashboard/research` | Discover stocks through creator coverage, browse creators and compare opinion changes |
| Deep Research | `/dashboard/trading-analysis` | Configure an AI analysis and review existing reports |
| Stock workspace | `/dashboard/research/[ticker]` | Inspect market, creator, technical, research and personal evidence together |
| Portfolio | `/dashboard/portfolio` | Review theses overlapping linked equity holdings, then inspect actual accounts and trades |
| Journal | `/dashboard/journal` | Review active/closed theses and immutable reasoning history |
| YouTube Opinions | `/dashboard/youtube-opinions` | Existing creator research experience, retained |

AI Chat and Trading Analysis are retained as capabilities. Ask Kolvex opens from the application shell; a question from a stock workspace carries its loaded market, creator, position, technical, research and thesis context. Prior conversations remain accessible there. `/dashboard/chat/*` retains existing conversation URLs. `/dashboard/trading-analysis/*` retains research configuration, published reports and existing report URLs. Research started from a stock workspace pre-fills that ticker. Its conclusion and investment plan come before expandable agent debates.

## Decision flow

1. Enter a ticker from Markets or Research, or open a linked equity ticker in Portfolio.
2. Read source coverage and recent creator calls. The creator direction uses the **latest opinion per creator within 30 days**; missing coverage is not neutral evidence. This is all tracked creators, not a personal following list.
3. Run chart AI analysis deliberately. The existing chart draws support, resistance, trendlines and Fibonacci levels, and retains creator markers and drawing synchronization.
4. When grounded in the chart, AI can propose a conditional entry range, invalidation and up to two targets. The backend rejects incoherent or out-of-range plans. Setup Alignment is five equal technical checks: trend, price vs EMA20, EMA20 vs EMA50, RSI momentum and volume. A complete score requires all inputs. It is not a return probability.
5. Use the setup as an editable draft, or write a thesis manually. Save direction, reasoning, optional price levels and a time horizon.
6. Return to Portfolio or Journal to compare the current quote and creator direction with saved thresholds/evidence. Run chart analysis in the workspace to compare technical direction. Review, change the reasoning or close the thesis; prior versions remain available.

## Persistence and deployment

The migration `kolvex-backend-py/supabase/migrations/20261008224118_investment_theses.sql` was applied to the production Supabase project `zekbqxpgivgznhnheima` on 2026-10-08. Its filename matches the production migration history. Deploy both frontend and Python backend for the new technical setup response.

`investment_thesis_versions` stores append-only snapshots. `investment_thesis_current` selects the newest version using an invoker-security view. Authenticated clients can select/insert only their own versions; anonymous clients cannot access either object. Updates/deletes are not granted. API handlers verify the authenticated user and validate plans. An expected-version check plus the unique `(user_id, thesis_id, version)` constraint prevents simultaneous reviews from overwriting one another.

Until the migration is applied, Journal and save actions show explicit unavailable errors. There is no local-only fallback that silently loses account persistence. The journal currently lists up to 500 current theses and up to 500 versions per thesis.

## Verification

- Production Next.js build succeeds. Existing warnings remain in AuthPageClient and VideoPlayer.
- `node --test scripts/decision-regressions.test.cjs scripts/chat-regressions.test.cjs` in the frontend: 14 tests pass.
- `./venv/bin/python -m unittest discover -s tests -p test_technical_analysis.py` in the backend: 15 tests pass.
- The migration was executed in temporary PGlite/PostgreSQL with test auth roles. Verified current-version selection, immutable history, duplicate-version conflicts, cross-user read/insert isolation, and anonymous denial. Production catalog checks also confirmed RLS ownership predicates, invoker security on the current view, and the intended role grants. No security advisor notices reference the new objects.
- Public homepage checked at 1440px and 390px, including the interactive decision demo; no horizontal overflow at 390px. Authenticated live end-to-end persistence requires the database migration and a signed-in session.

Reproduce the SQL checks without adding a project dependency:

```sh
npm install --prefix /tmp/kolvex-db-validation --no-audit --no-fund @electric-sql/pglite
node kolvex-backend-py/tests/test_thesis_schema.cjs /tmp/kolvex-db-validation/node_modules/@electric-sql/pglite
```

## Next milestones

The implemented review checks run when a page loads or the user refreshes. They do not yet run as a background monitor or send notifications. A target/invalidation label means the **current quote** crosses the level, not that an intraday historical crossing has been proven. Creator outcomes/accuracy, personal following, calibrated multi-source Consensus, automated thesis change notifications, and AI learning from closed outcomes remain later milestones. Fundamental/news reports stay source text rather than being assigned invented directional scores.

North star: **Weekly Active Theses**, counting unique theses created, viewed, updated, changed or reviewed within a week. Add a dedicated per-user activity stream before reporting this metric; saved-version counts alone cannot measure it. Supporting funnels: creator opinion → ticker workspace → thesis, thesis ↔ holdings overlap, revisit rate, and 7/30-day thesis retention.
