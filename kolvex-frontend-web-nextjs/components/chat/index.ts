// Chat components
export { ChatBubble } from "./ChatBubble";
export { ChatInput, ChatInputCompact } from "./ChatInput";
export { ChatSidebarContent } from "./ChatSidebarContent";
export { ChatWelcome } from "./ChatWelcome";
export { ChatMessageList } from "./ChatMessageList";
export { ChatContainer } from "./ChatContainer";

// Hook
export { useChatHistory } from "./useChatHistory";

// Types
export type {
  Message,
  ChatConversation,
  ChatHistoryItem,
  SearchSource,
  ChatInputProps,
  ChatBubbleProps,
  ChatMessageListProps,
  ChatHistorySidebarProps,
  ChatWelcomeProps,
} from "./types";

// Legacy export for backward compatibility
export { ChatBubble as ChatMessage } from "./ChatBubble";
