"use client";

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { MessageSquarePlus } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { ChatContainer } from "@/components/chat";
import { Button } from "@/components/ui/button";

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.id as string;
  const [conversationTitle, setConversationTitle] = useState<string>("Chat");

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
    // Navigate to the main chat page without specific ID
    router.push("/dashboard/chat");
  }, [router]);

  return (
    <DashboardLayout
      title={conversationTitle}
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
        initialConversationId={conversationId}
        onConversationChange={handleConversationChange}
      />
    </DashboardLayout>
  );
}
