"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { ChatWelcomeContainer } from "@/components/chat";
import { useTranslation } from "@/lib/i18n";

export default function Dashboard() {
  const { t } = useTranslation();

  return (
    <DashboardLayout
      title={t("chat.title")}
      showHeader={true}
      noTransition={true}
      headerClassName="lg:hidden"
    >
      <ChatWelcomeContainer className="flex-1" />
    </DashboardLayout>
  );
}
