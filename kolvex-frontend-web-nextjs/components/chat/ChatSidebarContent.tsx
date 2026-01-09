"use client";

import { useState, useEffect, useCallback } from "react";
import {
  MessageSquarePlus,
  Search,
  Clock,
  Trash2,
  MessagesSquare,
  ChevronLeft,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ChatHistoryItem } from "./types";
import { Button } from "../ui/button";
import { SearchInput } from "../ui/search-input";

// Storage utilities
const STORAGE_KEY = "kolvex_chat_history";

interface ChatConversation {
  id: string;
  title: string;
  messages: { id: string; role: string; content: string; timestamp?: string }[];
  createdAt: string;
  updatedAt: string;
}

function loadHistoryFromStorage(): ChatHistoryItem[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const data: ChatConversation[] = JSON.parse(stored);
    return data
      .map((conv) => ({
        id: conv.id,
        title: conv.title,
        preview:
          conv.messages[conv.messages.length - 1]?.content.slice(0, 100) || "",
        updatedAt: new Date(conv.updatedAt),
        messageCount: conv.messages.length,
      }))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  } catch {
    return [];
  }
}

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
  currentConversationId?: string | null;
  onSelectConversation?: (id: string) => void;
  onNewChat?: () => void;
  onDeleteConversation?: (id: string) => void;
  isCollapsed?: boolean;
}

export function ChatSidebarContent({
  currentConversationId: externalCurrentId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  isCollapsed = false,
}: ChatSidebarContentProps) {
  const [conversations, setConversations] = useState<ChatHistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(externalCurrentId || null);

  // Load and refresh conversations from localStorage
  const refreshConversations = useCallback(() => {
    const loaded = loadHistoryFromStorage();
    setConversations(loaded);
  }, []);

  useEffect(() => {
    refreshConversations();

    // Listen for storage changes (from other tabs or ChatContainer updates)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        refreshConversations();
      }
    };

    // Listen for current chat changes from ChatContainer
    const handleCurrentChatChange = (e: CustomEvent<{ id: string | null }>) => {
      setCurrentConversationId(e.detail.id);
      refreshConversations();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(
      "kolvex:currentChatChanged",
      handleCurrentChatChange as EventListener
    );

    // Also poll periodically for same-tab updates
    const interval = setInterval(refreshConversations, 1000);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(
        "kolvex:currentChatChanged",
        handleCurrentChatChange as EventListener
      );
      clearInterval(interval);
    };
  }, [refreshConversations]);

  // Sync with external prop if provided
  useEffect(() => {
    if (externalCurrentId !== undefined) {
      setCurrentConversationId(externalCurrentId);
    }
  }, [externalCurrentId]);

  const handleDelete = (id: string) => {
    if (onDeleteConversation) {
      onDeleteConversation(id);
    } else {
      // Direct delete from localStorage
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const data = JSON.parse(stored);
          const filtered = data.filter((c: ChatConversation) => c.id !== id);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
          refreshConversations();
        }
      } catch {
        // Ignore
      }
    }
  };

  const filteredConversations = conversations.filter(
    (conv) =>
      conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.preview.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const grouped = groupConversationsByDate(filteredConversations);

  // Collapsed state - just show icon
  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center py-2 gap-2">
        <button
          onClick={onNewChat}
          className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center hover:bg-primary/90 transition-colors"
          title="New Chat"
        >
          <MessageSquarePlus className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Back to Menu Link */}
      <div className="flex-shrink-0 border-b border-border-light dark:border-border-dark mb-2 pb-4 px-4">
        <Link
          href="/dashboard/analytics"
          className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          ← Back to Menu
        </Link>
      </div>
      {/* Header */}
      <div className="flex-shrink-0 px-3 pt-2 pb-3 space-y-3">
        {/* New Chat Button */}
        <Button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-medium text-xs hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25"
        >
          <MessageSquarePlus className="w-4 h-4" />
          New Chat
        </Button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto px-2 space-y-3">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center px-4">
            <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-2">
              <MessagesSquare className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {searchQuery ? "No matches" : "No chats yet"}
            </p>
          </div>
        ) : (
          <>
            <ConversationSection
              title="Today"
              conversations={grouped.today}
              currentConversationId={currentConversationId}
              onSelect={onSelectConversation}
              onDelete={handleDelete}
            />
            <ConversationSection
              title="Yesterday"
              conversations={grouped.yesterday}
              currentConversationId={currentConversationId}
              onSelect={onSelectConversation}
              onDelete={handleDelete}
            />
            <ConversationSection
              title="This Week"
              conversations={grouped.thisWeek}
              currentConversationId={currentConversationId}
              onSelect={onSelectConversation}
              onDelete={handleDelete}
            />
            <ConversationSection
              title="Older"
              conversations={grouped.older}
              currentConversationId={currentConversationId}
              onSelect={onSelectConversation}
              onDelete={handleDelete}
            />
          </>
        )}
      </div>
    </div>
  );
}

interface ConversationSectionProps {
  title: string;
  conversations: ChatHistoryItem[];
  currentConversationId?: string | null;
  onSelect?: (id: string) => void;
  onDelete?: (id: string) => void;
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
    <div className="space-y-1">
      <h3 className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
        {title}
      </h3>
      {conversations.map((conv) => (
        <ConversationItem
          key={conv.id}
          conversation={conv}
          isActive={conv.id === currentConversationId}
          onSelect={() => onSelect?.(conv.id)}
          onDelete={() => onDelete?.(conv.id)}
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
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
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
