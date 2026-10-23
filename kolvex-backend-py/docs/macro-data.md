# Macro indicators

## Free government indicators (current Markets tab)

`/dashboard?tab=macro` shows native cards for eight indicators. The authenticated
Next.js endpoint `/api/market/indicators` proxies
`GET /api/v1/market/indicators`. No API key, subscription or external-display switch is required for this allowlisted government dataset.

The service retrieves FRED's public CSV export. Mixed-frequency exports may be
ZIP archives with daily/monthly/quarterly CSV files; only CSV contents are parsed,
never extracted to disk. Export size and uncompressed size are bounded. Inputs:

| Card | Government series / calculation | Units |
| --- | --- | --- |
| 2Y / 10Y Treasury | Federal Reserve DGS2 / DGS10 | Yield %, prior-observation change in bp |
| 10Y−2Y spread | DGS10 minus DGS2 on matching dates | Percentage points, change in bp |
| CPI / core CPI YoY | BLS CPIAUCNS / CPILFENS, same-month ratio to prior year minus one | %, change in percentage points |
| Unemployment | BLS UNRATE | %, change in percentage points |
| Nonfarm jobs added | BLS PAYEMS minus previous calendar month | Thousands of people, change from prior month's additions |
| Real GDP growth | BEA A191RL1Q225SBEA | Already seasonally adjusted annualized QoQ %, change in percentage points |

CPI inputs are not seasonally adjusted; unemployment and payroll inputs are.
GDP is not annualized a second time. Missing prior months/years/quarters never
become fabricated changes. Values use the current published vintage and can be
revised. Observation dates identify the period measured, **not release dates**.
Each card links to its FRED source and the UI credits original government sources
and FRED. This allowlist does not authorize ingesting arbitrary third-party FRED
series; reassess source rights before adding series.

The service retains six calendar years for CPI YoY warm-up and 1Y/3Y/5Y charts.
It checks sources every six hours, with hourly retries for failures/partial data.
Redis shares `macro:government:v1` and a token-owned 90-second refresh lease across
replicas. Snapshots are retained for 30 days. Process-local caching is available
without Redis. `ECONOMIC_INDICATORS_WORKER_ENABLED=true` runs refresh checks in
FastAPI's lifecycle; cold or due reader requests can also fill the cache, with a
35-second collection deadline and a 45-second proxy timeout. Failed refreshes
preserve old values with stale status. No sample or paid-data fallback is used.

Sources:
- [Federal Reserve 2-year yield](https://fred.stlouisfed.org/series/DGS2)
- [Federal Reserve 10-year yield](https://fred.stlouisfed.org/series/DGS10)
- [CPI](https://fred.stlouisfed.org/series/CPIAUCNS), [Core CPI](https://fred.stlouisfed.org/series/CPILFENS)
- [Unemployment](https://fred.stlouisfed.org/series/UNRATE), [Nonfarm payrolls](https://fred.stlouisfed.org/series/PAYEMS)
- [Real GDP growth](https://fred.stlouisfed.org/series/A191RL1Q225SBEA)

Tests: `python -m unittest discover -s tests -p 'test_economic_indicators.py'`
and `node --test scripts/economic-indicators.test.cjs`.
