"use client";

import { useParams } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { ChatContainer } from "@/components/chat";

export default function ChatPage() {
  const params = useParams();
  const conversationId = params.id as string;

  return (
    <DashboardLayout
      title="Chat with Kolvex"
      showHeader={true}
      noTransition={true}
      headerClassName="lg:hidden"
    >
      <ChatContainer className="flex-1" initialConversationId={conversationId} />
    </DashboardLayout>
  );
}
