// Chat component types and interfaces

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: Date;
}

export interface ChatConversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatHistoryItem {
  id: string;
  title: string;
  preview: string;
  updatedAt: Date;
  messageCount: number;
}

export type SearchSource =
  | "web"
  | "portfolio"
  | "plaid";

export type AIModel =
  | "deepseek-flash"
  | "deepseek-v4-pro"
  | "gpt-6-astra"
  | "gpt-6.1-sol"
  | "gpt-6-luna"
  | "claude-fable-5-1"
  | "claude-opus-5-5"
  | "claude-sonnet-5-5"
  | "claude-haiku-5-5"
  | "gemini-3.8-flash"
  | "gemini-3.1-pro-preview"
  | "qwen3.8-max"
  | "qwen3.7-plus"
  | "qwen3.8-flash"
  | "kimi-k3"
  | "grok-4.7";

export interface AIModelConfig {
  id: AIModel;
  name: string;
  provider: "OpenAI" | "Anthropic" | "Google" | "DeepSeek" | "Qwen" | "Kimi" | "xAI";
  description?: string;
  isPro?: boolean;
}

export interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e?: React.FormEvent) => void;
  onCancel?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  isLoading?: boolean;
  isFocused?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  /** "inline" sits on the dialog ground; "panel" keeps the rounded composer used on the chat page. */
  appearance?: "panel" | "inline";
  activeSources?: SearchSource[];
  onToggleSource?: (source: SearchSource) => void;
  showSourceToggle?: boolean;
  inputRef?: React.RefObject<HTMLTextAreaElement>;
  // Model selection
  selectedModel?: AIModel;
  onSelectModel?: (model: AIModel) => void;
  showModelSelector?: boolean;
  /** Backend provider IDs with usable keys (e.g. ["openai","deepseek"]) */
  availableProviders?: string[];
  /** Human label for page evidence attached to this question. */
  evidenceLabel?: string;
  onClearEvidence?: () => void;
}

export interface ChatBubbleProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  timestamp?: Date;
  isFirst?: boolean;
  onRetry?: () => void;
  /** Display name of the model that generated this message (assistant only) */
  modelName?: string;
}

export interface ChatHistorySidebarProps {
  conversations: ChatHistoryItem[];
  currentConversationId?: string;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onDeleteConversation?: (id: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export interface ChatWelcomeProps {
  onSubmit: (query: string) => void;
  isLoading?: boolean;
  activeSources: SearchSource[];
  onToggleSource: (source: SearchSource) => void;
  selectedModel?: AIModel;
  onSelectModel?: (model: AIModel) => void;
  /** Backend provider IDs with usable keys */
  availableProviders?: string[];
  /** "compact" drops the page heading and navigation links for use inside a dialog */
  variant?: "page" | "compact";
  /** Overrides the default suggested questions */
  suggestions?: string[];
  /** Overrides the input placeholder, for example when a page context is attached. */
  placeholder?: string;
  /** Human label for page evidence attached to this question. */
  evidenceLabel?: string;
  onClearEvidence?: () => void;
}

// ===== Agent Tool Status =====

/** Maps tool names to human-readable labels */
export const TOOL_LABELS: Record<string, string> = {
  get_stock_quote: "Getting stock quote",
  get_stock_financials: "Fetching financials",
  get_analyst_recommendations: "Checking analyst ratings",
  get_stock_history: "Loading price history",
  get_company_info: "Looking up company info",
  get_user_portfolio: "Loading portfolio",
  web_search: "Searching the web",
};

export interface ToolStatus {
  name: string;
  label: string;
  status: "running" | "done";
}

export interface AgentStatus {
  stage: string;
  message?: string;
}

export interface ChatMessageListProps {
  messages: Message[];
  pendingUserMessage?: string;
  streamingContent?: string;
  isLoading?: boolean;
  messagesEndRef?: React.RefObject<HTMLDivElement>;
  activeTools?: ToolStatus[];
  agentStatus?: AgentStatus | null;
  errorMessage?: string | null;
  onRetry?: () => void;
  /** Display name of the currently selected model */
  modelName?: string;
}
