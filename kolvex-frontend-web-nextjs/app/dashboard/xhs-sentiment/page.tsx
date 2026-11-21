import type { Metadata } from "next";
import { Suspense } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import XhsSentimentPage from "@/components/xhs/XhsSentimentPage";

export const metadata: Metadata = {
  title: "小红书情绪 | Kolvex",
};

export default function Page() {
  return (
    <DashboardLayout>
      <Suspense fallback={null}>
        <XhsSentimentPage />
      </Suspense>
    </DashboardLayout>
  );
}
