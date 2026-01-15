"use client";

import { useState, useCallback } from "react";
import { MessageSquarePlus } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { ChatContainer } from "@/components/chat";
import { Button } from "@/components/ui/button";

export default function NewChatPage() {
  const [conversationTitle, setConversationTitle] =
    useState<string>("New Chat");

  const handleConversationChange = useCallback(
    (conversation: { id: string; title: string } | null) => {
      if (conversation) {
        setConversationTitle(conversation.title);
      } else {
        setConversationTitle("New Chat");
      }
    },
    []
  );

  const handleNewChat = useCallback(() => {
    // Dispatch event to trigger new chat in ChatContainer
    window.dispatchEvent(new CustomEvent("kolvex:newChat"));
  }, []);

  return (
    <DashboardLayout
      title={conversationTitle}
      showHeader={true}
      noTransition={true}
      headerClassName="lg:hidden"
      headerActions={
        <Button
          variant="outline"
          size="sm"
          onClick={handleNewChat}
          className="gap-2"
        >
          <MessageSquarePlus className="h-4 w-4" />
          <span className="hidden sm:inline">New Chat</span>
        </Button>
      }
    >
      <ChatContainer
        className="flex-1"
        onConversationChange={handleConversationChange}
      />
    </DashboardLayout>
  );
}
