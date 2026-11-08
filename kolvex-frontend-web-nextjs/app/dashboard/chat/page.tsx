"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { ChatWelcomeContainer } from "@/components/chat";
import { ChatHistorySheet } from "@/components/chat/ChatHistorySheet";

export default function NewChatPage() {
  return (
    <DashboardLayout
      title="New Chat"
      noTransition={true}
    >
      <div className="flex h-14 shrink-0 items-center pl-2 md:px-6">
        <ChatHistorySheet />
      </div>
      <ChatWelcomeContainer className="min-h-0 flex-1" />
    </DashboardLayout>
  );
}
