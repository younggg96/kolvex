"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { MessageSquarePlus } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { ChatDetailContainer } from "@/components/chat";
import { visibleQuestion } from "@/components/chat/pageEvidence";
import { Button } from "@/components/ui/button";

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const conversationId = params.id as string;
  const firstMessage = searchParams.get("firstMessage") || undefined;
  const pending = searchParams.get("pending");
  const [pendingMessage, setPendingMessage] = useState<string>();
  useEffect(() => {
    if (pending !== "1") return;
    try {
      const message = sessionStorage.getItem(
        `kolvex:pending:${conversationId}`,
      );
      if (message) {
        setPendingMessage(visibleQuestion(message));
        sessionStorage.removeItem(`kolvex:pending:${conversationId}`);
      }
    } catch {
      /* The command layer reports storage errors before navigating. */
    }
  }, [pending, conversationId]);
  const initialSources = searchParams.get("sources") || undefined;
  const initialModel = searchParams.get("model") || undefined;
  const [conversationTitle, setConversationTitle] = useState<string>("Chat");

  const handleConversationChange = useCallback(
    (conversation: { id: string; title: string } | null) => {
      if (conversation) {
        setConversationTitle(conversation.title);
      } else {
        setConversationTitle("New Chat");
      }
    },
    [],
  );

  const handleNewChat = useCallback(() => {
    router.push("/dashboard/chat");
  }, [router]);

  return (
    <DashboardLayout
      title={conversationTitle}
      headerActions={
        <Button
          variant="ghost"
          size="xs"
          onClick={handleNewChat}
          className="gap-2"
        >
          <MessageSquarePlus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">New Chat</span>
        </Button>
      }
    >
      <ChatDetailContainer
        key={conversationId}
        className="flex-1"
        conversationId={conversationId}
        firstMessage={pendingMessage || firstMessage}
        initialSources={initialSources}
        initialModel={initialModel}
        onConversationChange={handleConversationChange}
      />
    </DashboardLayout>
  );
}
