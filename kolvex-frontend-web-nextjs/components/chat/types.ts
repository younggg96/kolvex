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
  | "kol"
  | "news"
  | "web"
  | "portfolio"
  | "robinhood";

export type AIModel =
  | "gpt-4o"
  | "gpt-4o-mini"
  | "claude-opus-4-6"
  | "claude-sonnet-4-5"
  | "claude-haiku-4-5"
  | "gemini-2.5-pro"
  | "gemini-2.0-flash"
  | "deepseek-chat"
  | "deepseek-reasoner"
  | "qwen-plus"
  | "qwen-max"
  | "moonshot-v1-8k"
  | "moonshot-v1-128k"
  | "grok-3"
  | "grok-3-fast";

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
}

// ===== Agent Tool Status =====

/** Maps tool names to human-readable labels */
export const TOOL_LABELS: Record<string, string> = {
  get_stock_quote: "Getting stock quote",
  get_stock_financials: "Fetching financials",
  get_analyst_recommendations: "Checking analyst ratings",
  get_stock_history: "Loading price history",
  get_company_info: "Looking up company info",
  search_stock_news: "Searching news",
  get_trending_news: "Getting trending news",
  get_kol_latest_tweets: "Fetching KOL tweets",
  analyze_kol_sentiment: "Analyzing KOL sentiment",
  get_user_portfolio: "Loading portfolio",
  search_knowledge_base: "Searching knowledge base",
  get_superinvestor_holdings: "Checking super investor holdings",
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
