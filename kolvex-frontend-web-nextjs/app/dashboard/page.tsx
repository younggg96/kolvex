"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { ChatContainer } from "@/components/chat";

export default function Dashboard() {
  return (
    <DashboardLayout
      title="Chat with Kolvex"
      showHeader={true}
      noTransition={true}
      headerClassName="lg:hidden"
    >
      <ChatContainer className="flex-1" />
    </DashboardLayout>
  );
}
