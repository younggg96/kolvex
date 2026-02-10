/**
 * User API Keys Management
 * Client-side API for managing user-provided LLM provider API keys
 */

const API_PREFIX = "/api/user-api-keys";

// ===== Types =====

export interface UserApiKey {
  id: string;
  provider: string;
  api_key_masked: string;
  created_at: string;
  updated_at: string;
}

export interface UserApiKeysResponse {
  keys: UserApiKey[];
  supported_providers: string[];
}

export interface SuccessResponse {
  message: string;
  success: boolean;
}

// ===== Provider display metadata =====

export interface ProviderInfo {
  id: string;
  name: string;
  description: string;
  placeholder: string;
  docsUrl: string;
}

export const PROVIDER_INFO: Record<string, ProviderInfo> = {
  openai: {
    id: "openai",
    name: "OpenAI",
    description: "GPT-4o, GPT-4o Mini, o1, o3-mini",
    placeholder: "sk-...",
    docsUrl: "https://platform.openai.com/api-keys",
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude Opus 4.6, Sonnet 4.5, Haiku 4.5",
    placeholder: "sk-ant-...",
    docsUrl: "https://console.anthropic.com/settings/keys",
  },
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    description: "DeepSeek Chat, DeepSeek Reasoner",
    placeholder: "sk-...",
    docsUrl: "https://platform.deepseek.com/api_keys",
  },
  qwen: {
    id: "qwen",
    name: "Qwen (Alibaba)",
    description: "Qwen Plus, Qwen Turbo, Qwen Max",
    placeholder: "sk-...",
    docsUrl: "https://dashscope.console.aliyun.com/apiKey",
  },
  gemini: {
    id: "gemini",
    name: "Google Gemini",
    description: "Gemini 2.5 Pro, Gemini 2.0 Flash",
    placeholder: "AI...",
    docsUrl: "https://aistudio.google.com/apikey",
  },
  kimi: {
    id: "kimi",
    name: "Kimi (Moonshot)",
    description: "Moonshot v1 8K / 32K / 128K",
    placeholder: "sk-...",
    docsUrl: "https://platform.moonshot.cn/console/api-keys",
  },
  grok: {
    id: "grok",
    name: "Grok (xAI)",
    description: "Grok 3, Grok 3 Fast",
    placeholder: "xai-...",
    docsUrl: "https://console.x.ai/",
  },
};

export interface AvailableProvidersResponse {
  available_providers: string[];
}

// ===== API Functions =====

/**
 * Get which providers have usable API keys (server or user level)
 */
export async function getAvailableProviders(): Promise<AvailableProvidersResponse> {
  const response = await fetch(`${API_PREFIX}?action=available-providers`);

  if (!response.ok) {
    // Gracefully return empty if endpoint fails (e.g. table not yet created)
    console.warn("Failed to fetch available providers, defaulting to empty");
    return { available_providers: [] };
  }

  return response.json();
}

/**
 * Get all user API keys (masked values)
 */
export async function getUserApiKeys(): Promise<UserApiKeysResponse> {
  const response = await fetch(API_PREFIX);

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to fetch API keys: ${response.status}`);
  }

  return response.json();
}

/**
 * Create or update an API key for a provider
 */
export async function upsertUserApiKey(
  provider: string,
  apiKey: string
): Promise<UserApiKey> {
  const response = await fetch(API_PREFIX, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, api_key: apiKey }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to save API key: ${response.status}`);
  }

  return response.json();
}

/**
 * Delete an API key for a specific provider
 */
export async function deleteUserApiKey(
  provider: string
): Promise<SuccessResponse> {
  const response = await fetch(`${API_PREFIX}/${provider}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to delete API key: ${response.status}`);
  }

  return response.json();
}
