# Technical analysis focus

This change extends the existing stock chart analysis rather than introducing a
second analysis pipeline. Next.js `PriceChart` shares a focus selection across its
compact and advanced charts; `ChartView` submits it through the existing authenticated
Next.js proxy to FastAPI. The Python service computes evidence and asks the existing
LLM provider for structured explanations. Existing immutable analysis snapshots save
both the request and response; no new database migration is needed for focus selection.

## Reading and generation

Open **Analysis focus / 分析内容** above the stock chart. The collapsed row previews
the selected topics. Expand it for a plain checkbox grid of common topics, and open
**More categories / 更多类别** for topics with incomplete data. Choose any combination
of the twelve categories, or add up to five custom scenarios (200 characters each).
Use **Add scenario / 添加情景** to reveal the optional input; Enter adds it and Escape
or Cancel closes it. Trend, momentum, levels, scenarios and invalidation are selected by default. At least
one category or custom scenario must remain. Selection is free of network side effects;
**Generate / Update analysis** applies the current focus. Custom questions are optional.
The separate chart-drawing action uses levels and structure only; it does not consume
the custom written-analysis focus.
Controls are disabled during generation. Newly generated findings appear in both the
chart analysis panel and the stock page's AI Technical Analysis section. Both lead with
the summary and use a **Technical evidence / 分析依据** disclosure for topic details.
When topic findings exist, the legacy signal list is omitted to avoid repeating the
same evidence. Standard unavailable topics share a compact notice; unavailable custom
questions retain their individual explanations.

Each saved analysis keeps its own categories, scenarios and explanations. Loading a
saved version restores those choices for the next generation. Old snapshots without
focus fields still render and use the default selection. Unsaved choices are scoped to
the current stock chart; they are not stored in browser storage or sent to analytics.

## API contract

`POST /api/v1/market/ai-technical/{symbol}` accepts its existing history, visible-window
and locale parameters plus:

```json
{
  "categories": ["trend", "levels", "volume", "scenarios"],
  "custom_scenarios": ["What would confirm a resistance breakout?"]
}
```

Category IDs: `trend`, `momentum`, `levels`, `structure`, `volume`, `volatility`,
`patterns`, `timeframes`, `score`, `historical`, `scenarios`, `invalidation`.
Missing categories use defaults; an explicitly empty category list is permitted only
with a non-empty custom scenario. Duplicate values are removed, scenarios are trimmed,
and unknown IDs, excessive counts, oversized text or an empty total focus are rejected
by Pydantic (HTTP 422). The service also validates direct callers.

The existing result gains optional-compatible metadata:

```json
{
  "categories": ["volume"],
  "custom_scenarios": ["What would confirm a resistance breakout?"],
  "findings": [
    {"id": "volume", "status": "available", "explanation": "..."},
    {"id": "custom_0", "status": "unavailable", "explanation": "..."}
  ]
}
```

Custom IDs use their index in the saved `custom_scenarios` array. Requested order is
preserved. Unrequested model findings are discarded; missing findings become explicit
unavailable entries. The model's unavailable status is retained for custom questions.
Existing errors and settings/API-key recovery continue through the original endpoint.

## Evidence and limitations

- Trends and momentum reuse server-computed EMA20/50/200 and RSI14.
- Levels and structure reuse computed swing points and clustered level candidates.
- Volatility adds ATR percentage; volume adds current volume divided by the preceding
  twenty candles' average volume. Missing or zero volume yields unavailable evidence.
- Scenarios and invalidation explain conditional observations using existing levels.
- Pattern detection, multi-timeframe alignment, overall technical scoring and historical
  similarity have no complete deterministic engine in this endpoint. Their selected
  findings are forced to unavailable by the server, regardless of model output.
  This change does not implement the full quantitative roadmap in the attached brief.

The structured-output model adds `findings` (ID, status, explanation) to the existing
analysis schema. The prompt requires one finding per requested focus, disallows invented
indicators/scores/returns, and treats custom questions as untrusted data rather than
instructions. Standard unavailable findings use service-owned copy. Explanations for
supported topics remain LLM-generated; prompt instructions are not a guarantee of
perfect factual accuracy. Chart geometry continues through existing sanitation.

## Caching and files

The existing 600-second process cache now includes normalized category IDs and custom
scenario text in its key, alongside the original stock/window/locale keys. Different
focuses cannot reuse each other's explanations. The existing 200-entry bound remains.
Focus is saved in the current analysis-history JSON fields.

- `app/services/technical_focus.py`: category contract, validation, category guidance.
- `app/services/technical_analysis.py`: computed evidence, prompt, ordered findings, cache.
- `app/api/routes/market_data.py`: request schema and forwarding to the service.
- `lib/technicalFocus.ts`, `lib/stockApi.ts`: shared typed frontend request/result.
- `TechnicalFocusSelector`: shared controls using existing Input, Button and ChipButton.
- `TechnicalFindings`: shared result rendering used by stock workspace and chart panel.
- `PriceChart`, `ChartView`: shared selection, restoration and request integration.
- `lib/i18n/locales/{en,zh}.json`: labels, limits and validation messages.

## Verification

From the backend:

```sh
venv/bin/python -m unittest discover -s tests -p 'test_technical*.py'
```

Tests cover default/custom-only focus, unknown IDs, deduplication and limits, cache
isolation, unrequested/missing/unsupported findings, untrusted prompt placement,
relative-volume calculation and missing/zero-volume evidence. Existing chart algorithm
and sanitation tests remain in place.

Frontend verification uses TypeScript, targeted Next.js ESLint and the existing
`node --test scripts/decision-regressions.test.cjs` suite. Browser component checks use
local sample data; live stock generation still requires an authenticated account,
configured AI provider and the running backend. No external generation is performed by
these checks.

Verification evidence: 21 technical-analysis/focus tests and 7 existing decision
regressions passed, along with targeted ESLint and source TypeScript checks. Production
build and 390px browser component checks used an isolated local copy to avoid shared
Next.js cache conflicts. The full-project premium audit reported existing settings-page
select ownership/actionless-button and global scrollbar ownership findings; none
pointed at the new focus components. Live authenticated stock generation was not tested.
