import type { AIModel, AIModelConfig } from "@/components/chat/types";

// Model configurations
export const MODEL_CONFIGS: AIModelConfig[] = [
  // ---- DeepSeek (默认, 性价比高) ----
  {
    id: "deepseek-chat",
    name: "DeepSeek Chat",
    provider: "DeepSeek",
    description: "Cost effective, default",
  },
  {
    id: "deepseek-reasoner",
    name: "DeepSeek R1",
    provider: "DeepSeek",
    description: "Advanced reasoning",
    isPro: true,
  },
  // ---- OpenAI ----
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "OpenAI",
    description: "Most capable OpenAI model",
    isPro: true,
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "OpenAI",
    description: "Fast and efficient",
  },
  // ---- Anthropic (Claude 4.x) ----
  {
    id: "claude-opus-4-6",
    name: "Claude Opus 4.6",
    provider: "Anthropic",
    description: "Most intelligent model",
    isPro: true,
  },
  {
    id: "claude-sonnet-4-5",
    name: "Claude Sonnet 4.5",
    provider: "Anthropic",
    description: "Speed & intelligence balance",
    isPro: true,
  },
  {
    id: "claude-haiku-4-5",
    name: "Claude Haiku 4.5",
    provider: "Anthropic",
    description: "Fastest Claude model",
  },
  // ---- Google Gemini ----
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "Google",
    description: "Most capable Google model",
    isPro: true,
  },
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    provider: "Google",
    description: "Fast and latest",
  },
  // ---- Qwen ----
  {
    id: "qwen-max",
    name: "Qwen Max",
    provider: "Qwen",
    description: "Alibaba's most powerful",
    isPro: true,
  },
  {
    id: "qwen-plus",
    name: "Qwen Plus",
    provider: "Qwen",
    description: "Balanced performance",
  },
  // ---- Kimi (Moonshot) ----
  {
    id: "moonshot-v1-128k",
    name: "Kimi 128K",
    provider: "Kimi",
    description: "Ultra-long context",
    isPro: true,
  },
  {
    id: "moonshot-v1-8k",
    name: "Kimi 8K",
    provider: "Kimi",
    description: "Fast Kimi model",
  },
  // ---- Grok (xAI) ----
  {
    id: "grok-3",
    name: "Grok 3",
    provider: "xAI",
    description: "xAI flagship model",
    isPro: true,
  },
  {
    id: "grok-3-fast",
    name: "Grok 3 Fast",
    provider: "xAI",
    description: "Fast Grok model",
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

