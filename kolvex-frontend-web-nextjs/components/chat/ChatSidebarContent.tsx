"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Trash2, MessagesSquare, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { ChatHistoryItem } from "./types";
import * as chatApi from "@/lib/chatApi";

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function groupConversationsByDate(conversations: ChatHistoryItem[]) {
  const today: ChatHistoryItem[] = [];
  const yesterday: ChatHistoryItem[] = [];
  const thisWeek: ChatHistoryItem[] = [];
  const older: ChatHistoryItem[] = [];

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const weekStart = new Date(todayStart.getTime() - 7 * 86400000);

  conversations.forEach((conv) => {
    const convDate = new Date(conv.updatedAt);
    if (convDate >= todayStart) {
      today.push(conv);
    } else if (convDate >= yesterdayStart) {
      yesterday.push(conv);
    } else if (convDate >= weekStart) {
      thisWeek.push(conv);
    } else {
      older.push(conv);
    }
  });

  return { today, yesterday, thisWeek, older };
}

interface ChatSidebarContentProps {
  isCollapsed?: boolean;
}

export function ChatSidebarContent({
  isCollapsed = false,
}: ChatSidebarContentProps) {
  const router = useRouter();
  const [conversations, setConversations] = useState<ChatHistoryItem[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const initialLoadDone = useRef(false);

  // Load conversations from API
  const loadConversations = useCallback(async () => {
    if (typeof window === "undefined") return;

    try {
      const response = await chatApi.getConversations();
      const apiConversations: ChatHistoryItem[] = response.conversations.map(
        (conv) => ({
          id: conv.id,
          title: conv.title,
          preview:
            conv.messages[conv.messages.length - 1]?.content.slice(0, 100) ||
            "",
          updatedAt: new Date(conv.updated_at),
          messageCount: conv.messages.length,
        })
      );
      setConversations(apiConversations);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    // Listen for current chat changes (from useChatHistory)
    const handleCurrentChatChange = (e: CustomEvent<{ id: string | null }>) => {
      setCurrentConversationId(e.detail.id);
    };

    // Listen for conversation updates (refresh list when new message added)
    const handleConversationUpdate = () => {
      loadConversations();
    };

    window.addEventListener(
      "kolvex:currentChatChanged",
      handleCurrentChatChange as EventListener
    );
    window.addEventListener(
      "kolvex:conversationUpdated",
      handleConversationUpdate
    );

    return () => {
      window.removeEventListener(
        "kolvex:currentChatChanged",
        handleCurrentChatChange as EventListener
      );
      window.removeEventListener(
        "kolvex:conversationUpdated",
        handleConversationUpdate
      );
    };
  }, [loadConversations]);

  // Handle select conversation
  const handleSelectConversation = useCallback(
    (id: string) => {
      setCurrentConversationId(id);

      // Navigate to specific chat page
      router.push(`/dashboard/chat/${id}`);
    },
    [router]
  );

  // Handle delete conversation
  const handleDeleteConversation = useCallback(
    async (id: string) => {
      try {
        await chatApi.deleteConversation(id);

        // Update local state immediately
        const remaining = conversations.filter((c) => c.id !== id);
        setConversations(remaining);

        if (currentConversationId === id) {
          setCurrentConversationId(null);

          // Navigate: if there are other conversations, go to the most recent one;
          // otherwise go to new chat page
          if (remaining.length > 0) {
            router.push(`/dashboard/chat/${remaining[0].id}`);
          } else {
            router.push("/dashboard/chat");
          }
        }
      } catch (err) {
        console.error("Failed to delete conversation:", err);
      }
    },
    [currentConversationId, conversations, router]
  );

  const grouped = groupConversationsByDate(conversations);

  // Collapsed state - hide content
  if (isCollapsed) {
    return null;
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex flex-col h-full pl-3">
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (conversations.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto space-y-1 pl-3">
        <ConversationSection
          title="Today"
          conversations={grouped.today}
          currentConversationId={currentConversationId}
          onSelect={handleSelectConversation}
          onDelete={handleDeleteConversation}
        />
        <ConversationSection
          title="Yesterday"
          conversations={grouped.yesterday}
          currentConversationId={currentConversationId}
          onSelect={handleSelectConversation}
          onDelete={handleDeleteConversation}
        />
        <ConversationSection
          title="This Week"
          conversations={grouped.thisWeek}
          currentConversationId={currentConversationId}
          onSelect={handleSelectConversation}
          onDelete={handleDeleteConversation}
        />
        <ConversationSection
          title="Older"
          conversations={grouped.older}
          currentConversationId={currentConversationId}
          onSelect={handleSelectConversation}
          onDelete={handleDeleteConversation}
        />
      </div>
    </div>
  );
}

interface ConversationSectionProps {
  title: string;
  conversations: ChatHistoryItem[];
  currentConversationId?: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

function ConversationSection({
  title,
  conversations,
  currentConversationId,
  onSelect,
  onDelete,
}: ConversationSectionProps) {
  if (conversations.length === 0) return null;

  return (
    <div>
      <h3 className="px-2 py-1 text-[10px] font-bold tracking-wider text-gray-400 dark:text-gray-500">
        {title}
      </h3>
      {conversations.map((conv) => (
        <ConversationItem
          key={conv.id}
          conversation={conv}
          isActive={conv.id === currentConversationId}
          onSelect={() => onSelect(conv.id)}
          onDelete={() => onDelete(conv.id)}
        />
      ))}
    </div>
  );
}

interface ConversationItemProps {
  conversation: ChatHistoryItem;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onDelete,
}: ConversationItemProps) {
  const [showDelete, setShowDelete] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onSelect();
        }
      }}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
      className={cn(
        "group relative w-full flex items-start gap-2 p-2 rounded-lg text-left transition-all duration-200 cursor-pointer",
        isActive
          ? "bg-primary/10 text-primary"
          : "hover:bg-gray-100 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300"
      )}
    >
      <MessagesSquare className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 overflow-hidden">
        <p className="text-xs font-medium truncate">{conversation.title}</p>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
          {formatRelativeTime(new Date(conversation.updatedAt))}
        </p>
      </div>

      {showDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
