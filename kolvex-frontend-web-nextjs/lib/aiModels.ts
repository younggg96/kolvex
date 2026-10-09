import type { AIModel, AIModelConfig } from "@/components/chat/types";

// API model IDs verified against provider documentation on 2026-10-09.
export const MODEL_CONFIGS: AIModelConfig[] = [
  {
    "id": "deepseek-flash",
    "name": "DeepSeek V4.1 Flash",
    "provider": "DeepSeek",
    "isPro": false
  },
  {
    "id": "deepseek-v4-pro",
    "name": "DeepSeek V4 Pro",
    "provider": "DeepSeek",
    "isPro": true
  },
  {
    "id": "gpt-6-astra",
    "name": "GPT-6 Astra",
    "provider": "OpenAI",
    "isPro": true
  },
  {
    "id": "gpt-6.1-sol",
    "name": "GPT-6.1 Sol",
    "provider": "OpenAI",
    "isPro": true
  },
  {
    "id": "gpt-6-luna",
    "name": "GPT-6 Luna",
    "provider": "OpenAI",
    "isPro": false
  },
  {
    "id": "claude-fable-5-1",
    "name": "Claude Fable 5.1",
    "provider": "Anthropic",
    "isPro": true
  },
  {
    "id": "claude-opus-5-5",
    "name": "Claude Opus 5.5",
    "provider": "Anthropic",
    "isPro": true
  },
  {
    "id": "claude-sonnet-5-5",
    "name": "Claude Sonnet 5.5",
    "provider": "Anthropic",
    "isPro": true
  },
  {
    "id": "claude-haiku-5-5",
    "name": "Claude Haiku 5.5",
    "provider": "Anthropic",
    "isPro": false
  },
  {
    "id": "gemini-3.8-flash",
    "name": "Gemini 3.8 Flash",
    "provider": "Google",
    "isPro": true
  },
  {
    "id": "gemini-3.1-pro-preview",
    "name": "Gemini 3.1 Pro (Preview)",
    "provider": "Google",
    "isPro": true
  },
  {
    "id": "qwen3.8-max",
    "name": "Qwen 3.8 Max",
    "provider": "Qwen",
    "isPro": true
  },
  {
    "id": "qwen3.7-plus",
    "name": "Qwen 3.7 Plus",
    "provider": "Qwen",
    "isPro": false
  },
  {
    "id": "qwen3.8-flash",
    "name": "Qwen 3.8 Flash",
    "provider": "Qwen",
    "isPro": false
  },
  {
    "id": "kimi-k3",
    "name": "Kimi K3",
    "provider": "Kimi",
    "isPro": true
  },
  {
    "id": "grok-4.7",
    "name": "Grok 4.7",
    "provider": "xAI",
    "isPro": true
  }
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

/** Get the first available model ID from available provider IDs (for default selection) */
export function getFirstAvailableModelId(
  availableProviders: string[] | undefined
): AIModel | null {
  if (!availableProviders || availableProviders.length === 0) return null;
  const first = MODEL_CONFIGS.find((m) => {
    const id = PROVIDER_NAME_TO_ID[m.provider];
    return id ? availableProviders.includes(id) : false;
  });
  return first ? (first.id as AIModel) : null;
}

