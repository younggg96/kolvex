"use client";

import { ChatWelcomeContainer } from "./ChatWelcomeContainer";
import { ChatDetailContainer } from "./ChatDetailContainer";

interface ChatContainerProps {
  className?: string;
  initialConversationId?: string;
  onConversationChange?: (
    conversation: {
      id: string;
      title: string;
    } | null
  ) => void;
  onNewChat?: () => void;
}

/**
 * ChatContainer - A unified container that delegates to either
 * ChatWelcomeContainer or ChatDetailContainer based on whether
 * an initialConversationId is provided.
 *
 * @deprecated Consider using ChatWelcomeContainer or ChatDetailContainer directly
 * for better separation of concerns.
 */
export function ChatContainer({
  className,
  initialConversationId,
  onConversationChange,
}: ChatContainerProps) {
  if (initialConversationId) {
    return (
      <ChatDetailContainer
        className={className}
        conversationId={initialConversationId}
        onConversationChange={onConversationChange}
      />
    );
  }

  return (
    <ChatWelcomeContainer
      className={className}
      onConversationChange={onConversationChange}
    />
  );
}
