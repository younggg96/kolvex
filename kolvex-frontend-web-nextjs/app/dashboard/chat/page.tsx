"use client";

import { useTranslation } from "@/lib/i18n";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { ChatWelcomeContainer } from "@/components/chat";
import { ChatHistorySheet } from "@/components/chat/ChatHistorySheet";

export default function NewChatPage() {
  const { t } = useTranslation();
  return (
    <DashboardLayout title={t("chat.newChat")} noTransition={true}>
      <div className="flex h-14 shrink-0 items-center pl-4 md:px-6">
        <ChatHistorySheet className="glass-track glass-track-strong h-12 w-12 text-foreground max-md:h-12 max-md:w-12 [&_svg]:h-5 [&_svg]:w-5" />
      </div>
      <ChatWelcomeContainer className="min-h-0 flex-1" variant="dock" />
    </DashboardLayout>
  );
}
