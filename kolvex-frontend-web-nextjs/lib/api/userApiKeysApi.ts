/**
 * User API Keys Management
 * Client-side API for managing user-provided LLM provider API keys
 */

export const API_KEYS_CHANGED_EVENT = "kolvex:api-keys-changed";

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
    description: "GPT-6 Astra, GPT-6.1 Sol, GPT-6 Luna",
    placeholder: "sk-...",
    docsUrl: "https://platform.openai.com/api-keys",
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude Fable 5.1, Claude Opus 5.5, Claude Sonnet 5.5, Claude Haiku 5.5",
    placeholder: "sk-ant-...",
    docsUrl: "https://console.anthropic.com/settings/keys",
  },
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    description: "DeepSeek V4.1 Flash, DeepSeek V4 Pro",
    placeholder: "sk-...",
    docsUrl: "https://platform.deepseek.com/api_keys",
  },
  qwen: {
    id: "qwen",
    name: "Qwen (Alibaba)",
    description: "Qwen 3.8 Max, Qwen 3.7 Plus, Qwen 3.8 Flash",
    placeholder: "sk-...",
    docsUrl: "https://dashscope.console.aliyun.com/apiKey",
  },
  gemini: {
    id: "gemini",
    name: "Google Gemini",
    description: "Gemini 3.8 Flash, Gemini 3.1 Pro (Preview)",
    placeholder: "AI...",
    docsUrl: "https://aistudio.google.com/apikey",
  },
  kimi: {
    id: "kimi",
    name: "Kimi (Moonshot)",
    description: "Kimi K3",
    placeholder: "sk-...",
    docsUrl: "https://platform.moonshot.cn/console/api-keys",
  },
  grok: {
    id: "grok",
    name: "Grok (xAI)",
    description: "Grok 4.7",
    placeholder: "xai-...",
    docsUrl: "https://console.x.ai/",
  },
};

export interface AvailableProvidersResponse {
  available_providers: string[];
}

// ===== API Functions =====

/**
 * Get providers with user-configured API keys
 */
export async function getAvailableProviders(): Promise<AvailableProvidersResponse> {
  const response = await fetch(`${API_PREFIX}?action=available-providers`, { cache: "no-store" });

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

  const result = await response.json();
  window.dispatchEvent(new Event(API_KEYS_CHANGED_EVENT));
  return result;
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

  const result = await response.json();
  window.dispatchEvent(new Event(API_KEYS_CHANGED_EVENT));
  return result;
}
