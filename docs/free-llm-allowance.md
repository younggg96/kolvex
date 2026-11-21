# Free AI allowance (每周免费额度)

Signed-in users without their own model key can chat with **DeepSeek V4.1 Flash
(`deepseek-flash`)** on the server's DeepSeek key, up to **¥1 per user per week**.
Users with their own key for a provider keep using it, unmetered and unchanged.

## Rules

| Rule | Value | Where |
| --- | --- | --- |
| Free model | `deepseek-flash` only. Any other model asked for without the user's own key is answered by it. | `FREE_MODEL` in `kolvex-backend-py/app/services/free_llm_quota.py` |
| Weekly limit | ¥1 (`FREE_LLM_WEEKLY_LIMIT_YUAN`) | `app/core/config.py` |
| Week | Monday 00:00 to Sunday 24:00, Beijing time | `week_start()` |
| Cost of a call | DeepSeek's reported cache-hit / cache-miss / output tokens × the official Flash price (USD, peak or off-peak) × `FREE_LLM_USD_CNY` (default 7.2), rounded up | `cost_micro_yuan()` |
| Peak hours | Mon–Fri 01:00–04:00 and 06:00–10:00 UTC. Chinese public holidays are charged at peak. | `PEAK_UTC_HOURS` |
| No usage returned | Charged as one token per character of prompt and answer (above the real count) | `FreeQuotaCallback.on_llm_end` |
| Running total | Redis key `free_llm_spend:{user_id}:{week}` (millionths of a yuan, 8-day TTL), checked before every call. If Redis cannot be read, the free model is refused (`free_quota_unavailable`) instead of running unmetered. | `spent_micro()` |
| Ledger | Table `free_llm_usage_events`: one row per charged call (user, week, tokens, cost, `estimated`, `peak`), written before the Redis total. A missing Redis total is rebuilt from it with `free_llm_week_usage(user, week)` (migration `20261121050500_free_llm_week_usage.sql`); if neither can be read, the free model is refused. Backend-only (service role, insert and select). Migration `20261121050000_free_llm_usage_events.sql`. | `Ledger`, `record_spend()` |

At the 2026-11-20 price, ¥1 is roughly 90 peak-hour chat turns of 4,000 input
tokens (half cached) and 800 output tokens, or about twice that off-peak. Agent
turns that call tools send far more input and use the allowance faster.

## What counts

The billed user is set when the request is authenticated
(`get_current_user_id`), and `_create_llm` in `app/agent/llm.py` meters every
model it builds on a server key while serving that user. So chat, intent
routing, chat memory summaries and team research from chat all count. Work
with no signed-in user (scheduled jobs, admin imports with their own clients)
is not metered.

Not covered: multi-agent trading analysis (`build_ta_config`) refuses the
server key for a signed-in user (`own_key_required`, HTTP 403), and features
that already required the user's own key (AI fundamentals, valuation
assumptions, technical analysis, portfolio AI insights) are unchanged.

## API

- `GET /api/v1/user-api-keys/available-providers` adds `free_models`
  (`["deepseek-flash"]`, empty when the server has no DeepSeek key) and
  `free_allowance` (`model`, `used_percent`, `exhausted`, `resets_at`,
  `tokens`), or `null` when spend cannot be read. The limit is enforced in yuan,
  but no money figure leaves the backend: users see the share used (0–100,
  rounded up) and `tokens` (`input_tokens`, `cached_input_tokens`,
  `output_tokens`, `model_calls`) summed from the ledger, or `null` when the
  ledger cannot be read.
- Every assistant message carries `token_usage` (`input_tokens`,
  `cached_input_tokens`, `output_tokens`, `model_calls`, `incomplete`): the
  server's count over every model call of that turn (routing, the answering
  agent, model calls inside its tools; not the chat memory summary written
  afterwards). It is saved in `chat_messages.token_usage` (migration
  `20261121051000_chat_token_usage.sql`; before it, answers save without it),
  returned in the stream's `done` event and in message history. Counted for
  every model, the user's own keys included (`app/agent/turn_usage.py`).
- `POST /chat/conversations/{id}/stream` and `/send` return **429
  `free_quota_exceeded`** (or 503 `free_quota_unavailable`) before starting a
  turn on the free model once the week's allowance is spent.
- A turn that runs out part-way ends with a stream event
  `{"type": "error", "code": "free_quota_exceeded", ...}`.

## Web

The chat model menu enables `deepseek-flash` with a 免费 / Free badge and shows
「本周免费额度已用 38%」 with this week's input (cached) and output tokens. Each
answer's header shows 「输入 7,400 · 输出 800 token」, cached input in the hover
text, and 「至少」 when a call reported no usage. When it is spent, the free model is disabled and the
composer explains the Monday reset and links to Settings → API keys. Quota
errors are shown in the user's language by `code`.

## Auditing spend

```sql
select user_id, week_start, count(*) as calls, sum(cost_micro_yuan) / 1e6 as yuan,
       count(*) filter (where estimated) as estimated_calls
from public.free_llm_usage_events
group by user_id, week_start
order by week_start desc, yuan desc;
```

## Known limits

- The check runs before each model call, so a turn already in progress can
  finish slightly over ¥1; several conversations in parallel can overrun by a
  few calls.
- **Apply the migration before deploying this backend.** Without the table, a
  user with no Redis total yet this week (every user at first) is refused with
  `free_quota_unavailable`, and ledger writes fail (logged).
- Each charged call waits for one ledger insert (a service-client round trip).
- Prices are copied from the official page and must be updated by hand.
- The owner account is metered too unless it saves its own key.
