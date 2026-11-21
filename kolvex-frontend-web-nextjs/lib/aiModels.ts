import type { AIModel, AIModelConfig } from "@/components/chat/types";

// API model IDs verified against provider documentation on 2026-10-09.
export const MODEL_CONFIGS: AIModelConfig[] = [
  {
    id: "deepseek-flash",
    name: "DeepSeek V4.1 Flash",
    provider: "DeepSeek",
    isPro: false,
  },
  {
    id: "deepseek-v4-pro",
    name: "DeepSeek V4 Pro",
    provider: "DeepSeek",
    isPro: true,
  },
  {
    id: "gpt-6-astra",
    name: "GPT-6 Astra",
    provider: "OpenAI",
    isPro: true,
  },
  {
    id: "gpt-6.1-sol",
    name: "GPT-6.1 Sol",
    provider: "OpenAI",
    isPro: true,
  },
  {
    id: "gpt-6-luna",
    name: "GPT-6 Luna",
    provider: "OpenAI",
    isPro: false,
  },
  {
    id: "claude-fable-5-1",
    name: "Claude Fable 5.1",
    provider: "Anthropic",
    isPro: true,
  },
  {
    id: "claude-opus-5-5",
    name: "Claude Opus 5.5",
    provider: "Anthropic",
    isPro: true,
  },
  {
    id: "claude-sonnet-5-5",
    name: "Claude Sonnet 5.5",
    provider: "Anthropic",
    isPro: true,
  },
  {
    id: "claude-haiku-5-5",
    name: "Claude Haiku 5.5",
    provider: "Anthropic",
    isPro: false,
  },
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    provider: "Google",
    isPro: true,
  },
  {
    id: "gemini-3.1-pro-preview",
    name: "Gemini 3.1 Pro (Preview)",
    provider: "Google",
    isPro: true,
  },
  {
    id: "qwen3.8-max",
    name: "Qwen 3.8 Max",
    provider: "Qwen",
    isPro: true,
  },
  {
    id: "qwen3.7-plus",
    name: "Qwen 3.7 Plus",
    provider: "Qwen",
    isPro: false,
  },
  {
    id: "qwen3.8-flash",
    name: "Qwen 3.8 Flash",
    provider: "Qwen",
    isPro: false,
  },
  {
    id: "kimi-k3",
    name: "Kimi K3",
    provider: "Kimi",
    isPro: true,
  },
  {
    id: "grok-4.7",
    name: "Grok 4.7",
    provider: "xAI",
    isPro: true,
  },
];

// Map frontend display provider name → backend provider ID
export const PROVIDER_NAME_TO_ID: Record<string, string> = {
  OpenAI: "openai",
  Anthropic: "anthropic",
  DeepSeek: "deepseek",
  Google: "gemini",
  Qwen: "qwen",
  Kimi: "kimi",
  xAI: "grok",
};

/** Whether a model can be chosen: its provider has the user's own key, or it is the free model. */
export function isModelUsable(
  model: Pick<AIModelConfig, "id" | "provider">,
  availableProviders: string[] | undefined,
  freeModels: readonly string[] = [],
): boolean {
  if (freeModels.includes(model.id)) return true;
  const id = PROVIDER_NAME_TO_ID[model.provider];
  return Boolean(id && availableProviders?.includes(id));
}

/** Default selection: a model on the user's own key first, then the free model. */
export function getFirstAvailableModelId(
  availableProviders: string[] | undefined,
  freeModels: readonly string[] = [],
): AIModel | null {
  const own = MODEL_CONFIGS.find((m) => isModelUsable(m, availableProviders));
  const free = MODEL_CONFIGS.find((m) => freeModels.includes(m.id));
  return ((own ?? free)?.id as AIModel | undefined) ?? null;
}
