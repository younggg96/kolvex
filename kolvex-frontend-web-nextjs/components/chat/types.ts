import type { AnswerCheck, QuoteEvidence, RevenueEvidence, WebSource } from "@/lib/chatApi";
import type { FreeAllowance } from "@/lib/api/userApiKeysApi";
import type { TokenUsage } from "@/lib/tokenUsage";
import type { ChatSkill } from "./chatSkills";

// Chat component types and interfaces

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: Date;
  revenueEvidence?: RevenueEvidence[] | null;
  quoteEvidence?: QuoteEvidence[] | null;
  answerCheck?: AnswerCheck | null;
  tokenUsage?: TokenUsage | null;
  webSources?: WebSource[] | null;
  /** Suggested next questions; shown under the latest answer. */
  followUps?: string[] | null;
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

export type SearchSource = "web" | "portfolio" | "plaid";

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
  /**
   * "panel" is the rounded glass card used on the chat page, "inline" sits on
   * the dialog ground, and "docked" is the same card with tighter padding for a
   * composer that leads the page from the bottom.
   */
  appearance?: "panel" | "inline" | "docked";
  activeSources?: SearchSource[];
  onToggleSource?: (source: SearchSource) => void;
  showSourceToggle?: boolean;
  activeSkills?: ChatSkill[];
  onToggleSkill?: (skill: ChatSkill) => void;
  inputRef?: React.RefObject<HTMLTextAreaElement>;
  // Model selection
  selectedModel?: AIModel;
  onSelectModel?: (model: AIModel) => void;
  showModelSelector?: boolean;
  /** Backend provider IDs with usable keys (e.g. ["openai","deepseek"]) */
  availableProviders?: string[];
  /** Models usable without the user's own key (the free weekly allowance). */
  freeModels?: string[];
  /** This week's free allowance, shown in the model menu; null when not offered or unreadable. */
  freeAllowance?: FreeAllowance | null;
  /** Human label for page evidence attached to this question. */
  evidenceLabel?: string;
  onClearEvidence?: () => void;
  /** Extra classes for the typing area, e.g. a type size where it leads a surface. */
  fieldClassName?: string;
  /** Below lg, shrink the composer into a round button at its bottom-right corner. */
  collapsed?: boolean;
  onExpand?: () => void;
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
  /** Symbols this conversation already knows; their mentions get a logo and a link. */
  symbols?: string[];
  revenueEvidence?: RevenueEvidence[] | null;
  quoteEvidence?: QuoteEvidence[] | null;
  answerCheck?: AnswerCheck | null;
  /** Tokens the server counted for this answer's turn. */
  tokenUsage?: TokenUsage | null;
  /** Pages the answer's web searches returned; listed as its sources. */
  webSources?: WebSource[] | null;
  /** Saved message id; enables sharing the answer or a selected passage. */
  messageId?: string;
  /** The question this answer replies to, offered (optionally) with the share. */
  question?: string;
  /** User bubbles: "send" for a question just sent, "none" for its saved copy replacing it. */
  entrance?: "fade" | "send" | "none";
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
  activeSkills: ChatSkill[];
  onToggleSkill: (skill: ChatSkill) => void;
  selectedModel?: AIModel;
  onSelectModel?: (model: AIModel) => void;
  /** Backend provider IDs with usable keys */
  availableProviders?: string[];
  freeModels?: string[];
  freeAllowance?: FreeAllowance | null;
  /**
   * "page" is the full landing layout, "compact" drops the heading and link
   * rows for use inside a dialog, and "dock" is the chat page: the option rows
   * sit above the composer and the composer leads the page from the bottom.
   */
  variant?: "page" | "compact" | "dock";
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
  get_technical_indicators: "Calculating technical indicators",
  get_company_info: "Looking up company info",
  get_user_portfolio: "Loading portfolio",
  get_creator_opinions: "Reading creator opinions",
  get_creator_record: "Checking how stocks moved after a creator's opinions",
  get_creator_recent_opinions: "Reading a creator's recent opinions",
  search_creator_opinions: "Searching creator opinions",
  get_market_events: "Checking the market calendar",
  get_macro_indicators: "Reading macro indicators",
  get_institutional_holders: "Checking superinvestor 13F holders",
  get_superinvestor_portfolio: "Reading a superinvestor's 13F",
  get_congress_trades: "Checking congressional trades",
  get_options_activity: "Reading options activity",
  get_valuation: "Reading the valuation",
  get_market_buzz: "Checking market buzz",
  get_paper_trading_account: "Reading your paper-trading account",
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
  streamingQuoteEvidence?: QuoteEvidence[];
  streamingRevenueEvidence?: RevenueEvidence[];
  isLoading?: boolean;
  messagesEndRef?: React.RefObject<HTMLDivElement>;
  activeTools?: ToolStatus[];
  agentStatus?: AgentStatus | null;
  errorMessage?: string | null;
  onRetry?: () => void;
  /** Display name of the currently selected model */
  modelName?: string;
  /** Symbols this conversation already knows; their mentions get a logo and a link. */
  symbols?: string[];
  /** The reader dragged or wheeled the list; programmatic scrolling does not count. */
  onUserScroll?: () => void;
  /** Lets the scroll-to-bottom button use the space a collapsed composer frees. */
  composerCollapsed?: boolean;
  /** Sends a suggested follow-up question as the next message. */
  onFollowUp?: (question: string) => void;
}
