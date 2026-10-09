# Selectable AI models

Provider API model IDs were verified on 2026-10-09. Chat and chart analysis share
`kolvex-frontend-web-nextjs/lib/aiModels.ts`; backend routing uses
`kolvex-backend-py/app/agent/llm.py`. `tests/test_model_catalog.py` checks parity.

| Provider | Current choices | Official model catalog |
| --- | --- | --- |
| OpenAI | GPT-6 Astra, GPT-6.1 Sol, GPT-6 Luna | https://developers.openai.com/api/docs/models |
| Anthropic | Claude Fable 5.1, Opus 5.5, Sonnet 5.5, Haiku 5.5 | https://platform.claude.com/docs/en/models/overview |
| DeepSeek | V4.1 Flash (`deepseek-flash`), V4 Pro | https://api-docs.deepseek.com/quick_start/pricing/ |
| Google | Gemini 3.8 Flash, 3.1 Pro (Preview) | https://ai.google.dev/gemini-api/docs/models |
| Qwen | 3.8 Max, 3.7 Plus, 3.8 Flash | https://www.alibabacloud.com/help/en/model-studio/models |
| Kimi | K3 | https://platform.kimi.ai/docs/models |
| xAI | Grok 4.7 | https://docs.x.ai/developers/models |

Only providers with a user-configured key enable their choices. Saving or deleting
a key refreshes consumers in the same window; returning from another window
refreshes on focus. Loading availability cannot enable sending. Retired saved
model IDs are discarded; chat selects an available current model. Chart model
selection remains explicit. Availability means the user supplied a key, not that
the provider has granted access or sufficient quota; provider errors remain visible.

Current models with fixed sampling parameters omit temperature overrides.
`ThinkingChatOpenAI` preserves DeepSeek and Kimi reasoning state in ordinary and
streaming tool calls. This state is retained for the provider, not added to the
visible answer. See the provider guides:
https://api-docs.deepseek.com/guides/thinking_mode/
https://platform.kimi.ai/docs/guide/kimi-k3-quickstart
https://platform.claude.com/docs/en/claude_api_primer

Catalog updates are reviewed against official documentation. To update again,
change the frontend IDs/types, backend routing/defaults, and settings descriptions
in the same change, then run the parity/protocol tests. This catalog is curated;
it does not promise automatic discovery of future releases.
