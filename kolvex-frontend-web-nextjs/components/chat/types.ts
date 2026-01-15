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

export type SearchSource = "kol" | "news" | "web" | "portfolio";

export type AIModel =
  | "gpt-4o"
  | "gpt-4o-mini"
  | "claude-3.5-sonnet"
  | "claude-3.5-haiku"
  | "gemini-2.0-flash"
  | "gemini-1.5-pro"
  | "deepseek-chat"
  | "deepseek-reasoner";

export interface AIModelConfig {
  id: AIModel;
  name: string;
  provider: "OpenAI" | "Anthropic" | "Google" | "DeepSeek";
  description?: string;
  isPro?: boolean;
}

export interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e?: React.FormEvent) => void;
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
}

export interface ChatBubbleProps {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  timestamp?: Date;
  isFirst?: boolean;
  onRetry?: () => void;
}

export interface ChatMessageListProps {
  messages: Message[];
  pendingUserMessage?: string;
  streamingContent?: string;
  isLoading?: boolean;
  messagesEndRef?: React.RefObject<HTMLDivElement>;
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
}
