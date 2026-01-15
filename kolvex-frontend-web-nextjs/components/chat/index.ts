// Chat components
export { ChatBubble } from "./ChatBubble";
export { ChatInput } from "./ChatInput";
export { ChatSidebarContent } from "./ChatSidebarContent";
export { ChatWelcome } from "./ChatWelcome";
export { ChatMessageList } from "./ChatMessageList";
export { ChatContainer } from "./ChatContainer";
export { ChatWelcomeContainer } from "./ChatWelcomeContainer";
export { ChatDetailContainer } from "./ChatDetailContainer";

// Hook
export { useChatHistory } from "./useChatHistory";

// Types
export type {
  Message,
  ChatConversation,
  ChatHistoryItem,
  SearchSource,
  AIModel,
  AIModelConfig,
  ChatInputProps,
  ChatBubbleProps,
  ChatMessageListProps,
  ChatHistorySidebarProps,
  ChatWelcomeProps,
} from "./types";

// Legacy export for backward compatibility
export { ChatBubble as ChatMessage } from "./ChatBubble";
