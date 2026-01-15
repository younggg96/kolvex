"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { ChatWelcomeContainer } from "@/components/chat";

export default function NewChatPage() {
  return (
    <DashboardLayout
      title="New Chat"
      showHeader={true}
      noTransition={true}
      headerClassName="lg:hidden"
    >
      <ChatWelcomeContainer className="flex-1" />
    </DashboardLayout>
  );
}
